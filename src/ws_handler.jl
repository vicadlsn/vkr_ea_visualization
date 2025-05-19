using HTTP
using Sockets
using JSON
using GeneralizedGenerated
using Base.Threads
using UUIDs

include("./bbo.jl")
include("./caep.jl")
include("./ca.jl")

const DIMENSION = 2

function cleanup_tasks(optimizations::Dict{String, Task}, cancel_flags::Dict{String, Bool}, rlock::ReentrantLock)
    #lock(rlock) do
        for (key, task) in optimizations
            cancel_flags[key] = true
            wait(task)
        end
    #end
end

function handle_ws_client(http::HTTP.Stream)
    optimizations = Dict{String, Task}()
    cancel_flags = Dict{String, Bool}()
    rlock = ReentrantLock()
    client_id = string(uuid4())
    @info "Handling WebSocket client" client_id=client_id
    try
        HTTP.WebSockets.upgrade(http) do ws
            @info "New WebSocket connection established" client_id=client_id
            handle_ws_messages(ws, client_id, optimizations, cancel_flags, rlock)
        end
    catch e
        @error "Websocket error: $e" client_id=client_id
    finally
        cleanup_tasks(optimizations, cancel_flags, rlock)
        @info "Websocker closed" client_id=client_id
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
        @error "Failed to send error message: $e" client_id=cliend_id
    end
end

function handle_ws_messages(ws::HTTP.WebSocket, client_id::String, optimizations::Dict{String, Task}, cancel_flags::Dict{String, Bool}, rlock::ReentrantLock)
    for msg in ws
        @debug "Received message: $msg"
        data = try
            data = JSON.parse(String(msg))
        catch e
            @error "Error parsing JSON: $e"
            send_error(ws, client_id, nothing, "Invalid JSON")
            continue
        end

        if !haskey(data, "action")
            @error "Missing action field" data=data
            send_error(ws, client_id, data["request_id"], "Missing action")
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
                expr = Meta.parse(f_expr)
                mk_function(:( (x, y) -> ($expr) )) # скобки ($expr) нужны или нет???
            catch e
                @error "Failed to parse function: $e" func=f_expr
                send_error(ws, client_id, request_id, "Invalid function")
                continue
            end

            f_wrapped = v -> f(v[1], v[2])

            params = data["params"]
            params["population_size"] = data["population_size"]
            params["lower_bounds"] = data["lower_bounds"]
            params["upper_bounds"] = data["upper_bounds"]
            params["iterations_count"] = data["iterations_count"]
            
            #lock(rlock) do
                if haskey(optimizations, method_id)
                    @info "Cancelling previous task" method_id=method_id
                    cancel_flags[method_id] = true
                    wait(optimizations[method_id])
                end

                cancel_flags[method_id] = false
                optimizations[method_id] = @async begin
                    try
                        send(ws, JSON.json(Dict(
                            "action" => "start_ack",
                            "client_id" => client_id,
                            "request_id" => request_id,
                            "method_id" => method_id,
                            "status" => "ok"
                        )))
                        optimize(ws, f_wrapped, method_id, client_id, request_id, params, cancel_flags, rlock)
                    catch e
                        @error "Optimization failed: $e" method_id=method_id
                        send_error(ws, client_id, request_id, "Optimization error: $e")
                    finally
                        #lock(rlock) do
                            delete!(optimizations, method_id)
                            delete!(cancel_flags, method_id)
                        #end
                    end
                end
            #end
        elseif data["action"] == "stop"
            @info "Stop optimization request" client_id=client_id request_id=request_id method_id=method_id
            #lock(rlock) do
                if haskey(optimizations, method_id)
                    cancel_flags[method_id] = true
                    wait(optimizations[method_id])
                    send(ws, JSON.json(Dict(
                        "action" => "stop_ack",
                        "client_id" => client_id,
                        "request_id" => request_id,
                        "method_id" => method_id,
                        "status" => "ok"
                    )))
                else
                    send_error(ws, client_id, request_id, "No active process")
                end
            #end
        else
            @warn "Unknown action" action=data["action"]
            send_error(ws, client_id, request_id, "Unknown action")
        end
    end
    @info "WebSocket connection closed" client_id=client_id

end

function validate_start_params(data)
    required_fields = ["function", "method_id", "params", "population_size", "lower_bounds", "upper_bounds", "iterations_count"]
    for field in required_fields
        if !haskey(data, field)
            return false
        end
    end
    if !isa(data["lower_bounds"], Vector) || !isa(data["upper_bounds"], Vector) || length(data["lower_bounds"]) != 2 || length(data["upper_bounds"]) != 2
        return false
    end
    if data["population_size"] < 1 || data["iterations_count"] < 1
        return false
    end
    return true
end

function optimize(ws::HTTP.WebSocket, f_wrapped, method_id::String, client_id::String, request_id::String, params::Dict{String, Any}, cancel_flags::Dict{String, Bool}, rlock::ReentrantLock)
    lower_bounds = [Float64(p) for p in params["lower_bounds"]]
    upper_bounds = [Float64(p) for p in params["upper_bounds"]]

    @info "Starting optimization" method_id=method_id

    best_solution, best_fitness = nothing, nothing
    try
        if method_id == "bbo"
            best_solution, best_fitness =  BBO.bbo(ws, method_id, client_id, request_id, cancel_flags,  rlock, f_wrapped, DIMENSION, params["population_size"], lower_bounds, upper_bounds, params["iterations_count"], params["mutation_probability"], params["blending_rate"])
        elseif method_id == "cultural"
            best_solution, best_fitness = CAEP.cultural_algorithm(ws, method_id, client_id, request_id, cancel_flags,  rlock, f_wrapped, DIMENSION, params["population_size"], lower_bounds, upper_bounds, params["iterations_count"])
        else
            @error "Unknown method" method_id=method_id
            send_error(ws, client_id, request_id, "Unknown method")
            return
        end
        # Отправка финального результата
        #lock(rlock) do
            if !haskey(cancel_flags, method_id) || !cancel_flags[method_id]
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
        #end
    catch e
        @error "Optimization error: $e" client_id=client_id request_id=request_id method_id=method_id
        send_error(ws, client_id, request_id, "Optimization failed: $e")
    end
end
