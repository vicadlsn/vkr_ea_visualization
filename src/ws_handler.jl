using HTTP
using Sockets
using JSON
using Base.Threads
using UUIDs

include("./bbo.jl")
include("./caep.jl")
include("./ca.jl")
include("./math.jl")
include("./hs.jl")
include("./ws.jl")

const DIMENSION = 2

function cleanup_task(task::Task, cancel_flag::Bool)
    if !cancel_flag
        cancel_flag = true
        wait(task)
    end
end

function handle_ws_client(http::HTTP.Stream)
    client_id = string(uuid4())
    @info "Handling WebSocket client" client_id=client_id

    # Хранилище для одной задачи на соединение
    optimization_task = Ref{Union{Task, Nothing}}(nothing)
    cancel_flag = Ref{Bool}(false)

    try
        HTTP.WebSockets.upgrade(http) do ws
            @info "New WebSocket connection established" client_id=client_id
            handle_ws_messages(ws, client_id, optimization_task, cancel_flag)
        end
    catch e
        if isa(e, InterruptException)
            @warn "WebSocket interrupted: InterruptException" client_id=client_id
        else
            @error "WebSocket error: $e" client_id=client_id
        end
    finally
        if !isnothing(optimization_task[])
            cleanup_task(optimization_task[], cancel_flag[])
        end
        @info "WebSocket connection closed" client_id=client_id
    end
end

function send_error(ws, client_id, request_id, message)
    try
        send(ws, JSON.json(Dict(
            "action" => "error",
            "client_id" => client_id, 
            "request_id" => request_id,
            "message" => message
        )))
    catch e
        @error "Failed to send error message: $e" client_id=client_id
    end
end

function handle_ws_messages(ws::HTTP.WebSocket, client_id::String, optimization_task::Ref{Union{Task, Nothing}}, cancel_flag::Ref{Bool})
    for msg in ws
        @debug "Received message: $msg"
        data = try
            JSON.parse(String(msg))
        catch e
            @error "Error parsing JSON: $e"
            send_error(ws, client_id, nothing, "Invalid JSON")
            continue
        end

        if !haskey(data, "action")
            @error "Missing action field" data=data
            send_error(ws, client_id, get(data, "request_id", nothing), "Missing action")
            continue
        end

        request_id = get(data, "request_id", nothing)
        method_id = get(data, "method_id", nothing)

        if data["action"] == "start"
            @info "Start optimization request" client_id=client_id request_id=request_id method_id=method_id

            # Валидация параметров??
            if !validate_start_params(data)
                @error "Invalid start parameters" data=data
                send_error(ws, client_id, request_id, "Invalid parameters")
                continue
            end

            f_expr = data["function"]
            f = try
                MathParser.make_function_v2(f_expr)
            catch e
                @error "Failed to parse function: $e" func=f_expr
                send_error(ws, client_id, request_id, "Failed to parse function")
                continue
            end

            if isnothing(f)
                @error "Invalid function: $e" func=f_expr
                send_error(ws, client_id, request_id, "Invalid function")
                continue
            end

            params = data["params"]
            params["lower_bounds"] = data["lower_bounds"]
            params["upper_bounds"] = data["upper_bounds"]
            params["iterations_count"] = data["iterations_count"]
            
            if !isnothing(optimization_task[])
                @info "Cancelling previous task" method_id=method_id
                cancel_flag[] = true
                wait(optimization_task[])
            end

            cancel_flag[] = false
            optimization_task[] = @async begin
                try
                    send(ws, JSON.json(Dict(
                        "action" => "start_ack",
                        "client_id" => client_id,
                        "request_id" => request_id,
                        "method_id" => method_id,
                        "status" => "ok"
                    )))
                    optimize(ws, f, method_id, client_id, request_id, params, cancel_flag)
                catch e
                    @error "Optimization failed: $e" method_id=method_id
                    send_error(ws, client_id, request_id, "Optimization error: $e")
                finally
                    optimization_task[] = nothing
                    cancel_flag[] = false
                end
            end
        elseif data["action"] == "stop"
            @info "Stop optimization request" client_id=client_id request_id=request_id method_id=method_id
            if !isnothing(optimization_task[])
                cancel_flag[] = true
                wait(optimization_task[])
                send(ws, JSON.json(Dict(
                    "action" => "stop_ack",
                    "client_id" => client_id,
                    "request_id" => request_id,
                    "method_id" => method_id,
                    "status" => "ok"
                )))
                optimization_task[] = nothing
                cancel_flag[] = false
            else
                send_error(ws, client_id, request_id, "No active process")
            end
        else
            @warn "Unknown action" action=data["action"]
            send_error(ws, client_id, request_id, "Unknown action")
        end
    end
    @info "WebSocket connection closed" client_id=client_id

end

function validate_start_params(data)
    required_fields = ["function", "method_id", "params", "lower_bounds", "upper_bounds", "iterations_count"]
    for field in required_fields
        if !haskey(data, field)
            return false
        end
    end
    if !isa(data["lower_bounds"], Vector) || !isa(data["upper_bounds"], Vector) || length(data["lower_bounds"]) != 2 || length(data["upper_bounds"]) != 2
        return false
    end
    if data["iterations_count"] < 1
        return false
    end
    return true
end

function optimize(ws::HTTP.WebSocket, f_v, method_id::String, client_id::String, request_id::String, params::Dict{String, Any}, cancel_flag::Ref{Bool})
    lower_bounds = [Float64(p) for p in params["lower_bounds"]]
    upper_bounds = [Float64(p) for p in params["upper_bounds"]]

    @info "Starting optimization" method_id=method_id
    @info "Parameters:" method_id=method_id params=JSON.json(params)
    best_solution, best_fitness = nothing, nothing
    try
        if method_id == "bbo"
            best_solution, best_fitness = BBO.bbo(
                ws, method_id, client_id, request_id, cancel_flag, f_v, DIMENSION,
                lower_bounds, upper_bounds, params["iterations_count"], params["islands_count"];
                mutation_probability=params["mutation_probability"], blending_rate=params["blending_rate"],
                num_elites=params["num_elites"], send_func=send_optimization_data
            )
        elseif method_id == "cultural"
            population_size = params["population_size"]
            num_elites = params["num_elites"]
            num_accepted = params["num_accepted"]
            dim = DIMENSION
            max_iters = params["iterations_count"]
            best_solution, best_fitness = CA.cultural_algorithm(
                ws, method_id, client_id, request_id, cancel_flag,
                f_v, dim, lower_bounds, upper_bounds, max_iters, population_size;
                num_elites=num_elites, num_accepted=num_accepted, send_func=send_optimization_data
            )
        elseif method_id == "harmony"
            dim = DIMENSION
            hms = params["hms"]
            max_iters = params["iterations_count"]
            mode = get(params, "mode", "canonical")
            if mode == "canonical"
                hmcr = params["hmcr"]
                par = params["par"]
                bw = params["bw"]
                best_solution, best_fitness = HS.harmony_search(
                    ws, method_id, client_id, request_id, cancel_flag,
                    f_v, dim, lower_bounds, upper_bounds, max_iters, hms;
                    hmcr=hmcr, par=par, bw=bw, mode="canonical", send_func=send_optimization_data
                )
            elseif mode == "adaptive"
                best_solution, best_fitness = HS.harmony_search(
                    ws, method_id, client_id, request_id, cancel_flag,
                    f_v, dim, lower_bounds, upper_bounds, max_iters, hms;
                    mode="adaptive", send_func=send_optimization_data
                )
            else
                @error "Unknown HS mode" mode=mode
                send_error(ws, client_id, request_id, "Unknown Harmony Search mode: $mode")
                return
            end
        else
            @error "Unknown method" method_id=method_id
            send_error(ws, client_id, request_id, "Unknown method")
            return
        end
        @info "Optimization completed" client_id=client_id request_id=request_id method_id=method_id best_solution=string(best_solution) best_fitness=best_fitness
        if !cancel_flag[]
            send(ws, JSON.json(Dict(
                "action" => "complete",
                "client_id" => client_id,
                "request_id" => request_id,
                "method_id" => method_id,
                "final_solution" => best_solution,
                "final_fitness" => best_fitness,
                "iterations" => params["iterations_count"]
            )))
            @info "Optimization completed" method_id=method_id
        end
    catch e
        @error "Optimization error: $e" client_id=client_id request_id=request_id method_id=method_id
        send_error(ws, client_id, request_id, "Optimization failed: $e")
    end
end
