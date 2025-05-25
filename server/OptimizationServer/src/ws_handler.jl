module WSHandler

using HTTP
using Sockets
using JSON
using Base.Threads
using UUIDs
using PrecompileTools
using OptimizationAlgorithms, MathParser

export handle_ws_client

const DIMENSION = 2

function cleanup_task(task::Task, cancel_flag::Ref{Bool})
    if !cancel_flag[]
        cancel_flag[] = true
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
            return  # После warn сразу выйти из try/catch, чтобы перейти в finally
        else
            @error "WebSocket error" error=e client_id=client_id
        end
    finally
        if !isnothing(optimization_task[])
            cleanup_task(optimization_task[], cancel_flag)
        end
        @info "WebSocket connection closed" client_id=client_id
    end
end

function send_error(ws, client_id, request_id, message)
    try
        HTTP.WebSockets.send(ws, JSON.json(Dict(
            "action" => "error",
            "client_id" => client_id, 
            "request_id" => request_id,
            "message" => message
        )))
    catch e
        @error "Failed to send error message" error=e client_id=client_id
    end
end

function handle_ws_messages(ws::HTTP.WebSocket, client_id::String, optimization_task::Ref{Union{Task, Nothing}}, cancel_flag::Ref{Bool})
    method_id = ""
    try
    for msg in ws
        @debug "Received message: $msg" client_id=client_id
    
        data = try
            t_json_start = time()
            data = JSON.parse(String(msg))
            t_json = time() - t_json_start
            @info "JSON parsing took $t_json seconds" client_id=client_id
            data
        catch e
            @error "Error parsing JSON" error=e client_id=client_id
            send_error(ws, client_id, nothing, "Invalid JSON")
            continue
        end

        if !haskey(data, "action")
            @error "Missing action field" data=data client_id=client_id
            send_error(ws, client_id, get(data, "request_id", nothing), "Missing action")
            continue
        end

        request_id = get(data, "request_id", nothing)
        method_id = get(data, "method_id", nothing)

        if data["action"] == "start"
            @info "Start optimization request" client_id=client_id request_id=request_id method_id=method_id

            # Валидация параметров??
            if !validate_start_params(data)
                @error "Invalid start parameters" data=data client_id=client_id request_id=request_id method_id=method_id
                send_error(ws, client_id, request_id, "Invalid parameters")
                continue
            end

            f_expr = data["function"]
            f = try
                t_parse_start = time()
                f = MathParser.make_function_v2(f_expr)
                t_parse = time() - t_parse_start
                @info "Function parsing took $t_parse seconds" client_id=client_id request_id=request_id method_id=method_id
                f
            catch e
                @error "Failed to parse function" error=e func=f_expr client_id=client_id request_id=request_id method_id=method_id
                send_error(ws, client_id, request_id, "Failed to parse function")
                continue
            end

            if isnothing(f)
                @error "Invalid function" func=f_expr client_id=client_id request_id=request_id method_id=method_id
                send_error(ws, client_id, request_id, "Invalid function")
                continue
            end

            params = Dict{String, Any}(data["params"])
            params["lower_bounds"] = data["lower_bounds"]
            params["upper_bounds"] = data["upper_bounds"]
            params["iterations_count"] = data["iterations_count"]
            
            if !isnothing(optimization_task[])
                @info "Cancelling previous task" client_id=client_id request_id=request_id method_id=method_id
                cancel_flag[] = true
                wait(optimization_task[])
            end

            cancel_flag[] = false
            optimization_task[] = @async begin
                try
                    HTTP.WebSockets.send(ws, JSON.json(Dict(
                        "action" => "start_ack",
                        "client_id" => client_id,
                        "request_id" => request_id,
                        "method_id" => method_id,
                        "status" => "ok"
                    )))
                    t_opt_start = time()
                    optimize(ws, f, method_id, client_id, request_id, params, cancel_flag)
                    t_opt = time() - t_opt_start
                    @info "Optimization took $t_opt seconds" client_id=client_id request_id=request_id method_id=method_id
                catch e
                    @error "Optimization failed" error=e client_id=client_id request_id=request_id method_id=method_id
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
                HTTP.WebSockets.send(ws, JSON.json(Dict(
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
            @warn "Unknown action" action=data["action"] client_id=client_id request_id=request_id
            send_error(ws, client_id, request_id, "Unknown action")
        end
    end
    catch e
        if isa(e, EOFError)
            @info "Client disconnected (EOF)" client_id=client_id method_id=method_id
        else
            @error "Unhandled error in WS message handler" error=e client_id=client_id method_id=method_id
        end
    end
    @info "WebSocket connection closed" client_id=client_idmethod_id=method_id

end

function validate_start_params(data)
    required_fields = ["function", "method_id", "params", "lower_bounds", "upper_bounds", "iterations_count"]
    for field in required_fields
        if !haskey(data, field)
            @error "Missing required field" field=field request_id=get(data, "request_id", nothing)
            return false
        end
    end
    if !isa(data["lower_bounds"], Vector) || !isa(data["upper_bounds"], Vector) || length(data["lower_bounds"]) != 2 || length(data["upper_bounds"]) != 2
        @error "Invalid bounds format" request_id=get(data, "request_id", nothing)
        return false
    end
    if data["iterations_count"] < 1
        @error "Invalid iterations_count, must be >= 1" request_id=get(data, "request_id", nothing)
        return false
    end
    return true
end

function optimize(ws::HTTP.WebSocket, f_v, method_id::String, client_id::String, request_id::String, params::Dict{String, Any}, cancel_flag::Ref{Bool})
    send_iter = send_optimization_data_closure(ws, client_id, request_id, method_id, cancel_flag)

    lower_bounds = [Float64(p) for p in params["lower_bounds"]]
    upper_bounds = [Float64(p) for p in params["upper_bounds"]]

    @info "Starting optimization" method_id=method_id
    @info "Parameters:" method_id=method_id params=JSON.json(params)
    best_solution, best_fitness = nothing, nothing
    try
        if method_id == "bbo"
            best_solution, best_fitness = OptimizationAlgorithms.bbo(cancel_flag, f_v, DIMENSION,
                lower_bounds, upper_bounds, params["iterations_count"], params["islands_count"];
                mutation_probability=params["mutation_probability"], blending_rate=params["blending_rate"],
                num_elites=params["num_elites"], send_func=send_iter
            )
        elseif method_id == "cultural"
            population_size = params["population_size"]
            num_elites = params["num_elites"]
            num_accepted = params["num_accepted"]
            dim = DIMENSION
            max_iters = params["iterations_count"]
            best_solution, best_fitness = OptimizationAlgorithms.cultural_algorithm(cancel_flag,
                f_v, dim, lower_bounds, upper_bounds, max_iters, population_size;
                num_elites=num_elites, num_accepted=num_accepted, send_func=send_iter
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
                best_solution, best_fitness = OptimizationAlgorithms.harmony_search(cancel_flag,
                    f_v, dim, lower_bounds, upper_bounds, max_iters, hms;
                    hmcr=hmcr, par=par, bw=bw, mode="canonical", send_func=send_iter
                )
            elseif mode == "adaptive"
                best_solution, best_fitness = OptimizationAlgorithms.harmony_search(cancel_flag,
                    f_v, dim, lower_bounds, upper_bounds, max_iters, hms;
                    mode="adaptive", send_func=send_iter
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
            HTTP.WebSockets.send(ws, JSON.json(Dict(
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
        @error "Optimization error" error=e client_id=client_id request_id=request_id method_id=method_id
        send_error(ws, client_id, request_id, "Optimization failed: $e")
    end
end

function send_optimization_data_closure(
    ws::HTTP.WebSocket,
    client_id::String,
    request_id::Union{String, Nothing},
    method_id::Union{String, Nothing},
    cancel_flag::Ref{Bool}
)
    return function (
        iteration, best_fitness, best_solution,
        current_best_fitness, current_best_solution,
        population
    )
        if ws === nothing || ws.writeclosed
            @warn "WebSocket is closed. Stopping process" client_id=client_id request_id=request_id method_id=method_id
            cancel_flag[]=true
            return
            #error("WebSocket is closed") 
        end

        try
            json_data = JSON.json(Dict(
                "action" => "iteration",
                "client_id" => client_id,
                "request_id" => request_id,
                "method_id" => method_id,
                "iteration" => iteration,
                "population" => population,
                "best_fitness" => best_fitness,
                "best_solution" => best_solution,
                "current_best_fitness" => current_best_fitness,
                "current_best_solution" => current_best_solution
            ))
            HTTP.WebSockets.send(ws, json_data)
            @debug "Sent iteration data" method_id=method_id iteration=iteration
        catch e
            @error "Error sending iteration data. Stopping process" error=e client_id=client_id request_id=request_id method_id=method_id
            cancel_flag[] = true
        end
    end
end

# Warm-up функция для прекомпиляции
function warmup()
    t_start = time()
    @info "Запуск warm-up для прекомпиляции функций оптимизации"
    
    # Простая функция для парсинга
    f = MathParser.make_function_v2("x^2+y^2")
    
    # Минимальные параметры
    dim = 2
    lower_bounds = [-5.0, -5.0]
    upper_bounds = [5.0, 5.0]
    cancel_flag = Ref{Bool}(false)
    
    # Функция для отправки данных (пустая, чтобы минимизировать выполнение)
    send_func = (iteration, best_fitness, best_solution, current_best_fitness, current_best_solution, population) -> nothing
    
    # Вызов методов оптимизации
    OptimizationAlgorithms.bbo(
        cancel_flag, f, dim, lower_bounds, upper_bounds, 0,1;
        mutation_probability=0.1, blending_rate=0.0, num_elites=1, send_func=send_func
    )
    
    OptimizationAlgorithms.cultural_algorithm(
        cancel_flag, f, dim, lower_bounds, upper_bounds, 0, 1;
        num_elites=1, num_accepted=1, send_func=send_func
    )
    
    OptimizationAlgorithms.harmony_search(
        cancel_flag, f, dim, lower_bounds, upper_bounds, 0, 1;
        hmcr=0.9, par=0.3, bw=0.01, mode="canonical", send_func=send_func
    )
    
    OptimizationAlgorithms.harmony_search(
        cancel_flag, f, dim, lower_bounds, upper_bounds, 0, 1;
        mode="adaptive", send_func=send_func
    )
    
    # прекомпилируем MathParser
    MathParser.make_function_v2("sin(e*x^2) + cos(y^2) + E")

    t_total = time() - t_start
    @info "Warm-up занял $t_total секунд"
end

@setup_workload begin
    @compile_workload begin
        warmup()
    end
end

end