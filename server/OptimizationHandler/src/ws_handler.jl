module WSHandler

using HTTP
using Sockets
using JSON
using Base.Threads
using UUIDs
using PrecompileTools
using OptimizationAlgorithms, MathParser
using BenchmarkTools

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
            return
        else
            @error "WebSocket error" error=e client_id=client_id
        end
    finally
        if !isnothing(optimization_task[])
            cleanup_task(optimization_task[], cancel_flag)
        end
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

            if !isnothing(optimization_task[])
                @info "Previous task still running. Cancelling request." client_id=client_id request_id=request_id method_id=method_id
                send_error(ws, client_id, request_id, "Previous task is in process")
                continue 
            end

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

            HTTP.WebSockets.send(ws, JSON.json(Dict(
                "action" => "start_ack",
                "client_id" => client_id,
                "request_id" => request_id,
                "method_id" => method_id,
                "status" => "ok"
            )))

            cancel_flag[] = false
            optimization_task[] = @async begin
                try
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
    @info "WebSocket connection closed" client_id=client_id method_id=method_id

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

function parse_param(params, key, ::Type{T}) where T
    if !haskey(params, key)
        return nothing
    end
    val = params[key]
    try
        return T(val)
    catch
        return nothing
    end
end

function validate_bbo_params(params)
    required = [
        ("iterations_count", Int),
        ("islands_count", Int),
        ("mutation_probability", Float64),
        ("blending_rate", Float64),
        ("num_elites", Int),
    ]
    for (key, typ) in required
        val = parse_param(params, key, typ)
        if val === nothing
            return false, "Missing or invalid parameter: $key"
        end
        params[key] = val
    end
    if params["iterations_count"] < 1
        return false, "iterations_count must be >= 1"
    end
    if params["islands_count"] < 1
        return false, "islands_count must be >= 1"
    end
    if !(0.0 <= params["mutation_probability"] <= 1.0)
        return false, "mutation_probability must be in [0, 1]"
    end
   
    if !(0.0 <= params["blending_rate"] <= 1.0)
        return false, "blending_rate must be in [0, 1]"
    end
    if params["num_elites"] < 0
        return false, "num_elites must be >= 0"
    end
    if params["islands_count"] < params["num_elites"]
        return false, "islands_count must be >= num_elites"
    end
    return true, ""
end

function validate_cultural_params(params)
    required = [
        ("population_size", Int),
        ("num_accepted", Int),
        ("iterations_count", Int),
        ("inertia", Float64),
        ("gamma", Float64),
        ("beta", Float64)
    ]
    for (key, typ) in required
        val = parse_param(params, key, typ)
        if val === nothing
            return false, "Missing or invalid parameter: $key"
        end
        params[key] = val
    end
    if params["population_size"] < 1 || params["iterations_count"] < 1
        return false, "population_size and iterations_count must be >= 1"
    end

    if params["num_accepted"] < 1
        return false, "num_accepted must be >= 1"
    end

    if params["num_accepted"] > params["population_size"]
        return false, "num_accepted must be <= population_size"
    end

    if  params["inertia"] < 0 || params["inertia"] > 1
            return false, "inertia must be in [0, 1]"
    end

    if  params["gamma"] < 0
        return false, "gamma must be > 0"
    end

    if  params["beta"] < 0
        return false, "beta must be > 0"
    end

    return true, ""
end

function validate_harmony_params(params)
    required = [
        ("hms", Int),
        ("iterations_count", Int),
        ("hmcr", Float64),
    ]
    for (key, typ) in required
        val = parse_param(params, key, typ)
        if val === nothing
            return false, "Missing or invalid parameter: $key"
        end
        params[key] = val
    end
    if params["hms"] < 1 || params["iterations_count"] < 1
        return false, "hms and iterations_count must be >= 1"
    end

    if !(0.0 <= params["hmcr"] <= 1.0)
        return false, "hmcr must be in [0,1]"
    end

    mode = get(params, "mode", "canonical")
    if mode == "canonical"
        for (key, typ) in [("par", Float64), ("bw", Float64)]
            val = parse_param(params, key, typ)
            if val === nothing
                return false, "Missing or invalid parameter for canonical mode: $key"
            end
            params[key] = val
        end
        if !(0.0 <= params["par"] <= 1.0) || params["bw"] < 0
            return false, "hmcr/par must be in [0,1], bw >= 0"
        end
    elseif mode == "adaptive"
        for (key, typ) in [("par_start", Float64), ("bw_start", Float64), ("par_end", Float64), ("bw_end", Float64)]
            val = parse_param(params, key, typ)
            if val === nothing
                return false, "Missing or invalid parameter for canonical mode: $key"
            end
            params[key] = val
        end
        if !(0.0 <= params["par_start"] <= 1.0) || !(0.0 <= params["par_end"] <= 1.0) || params["bw_start"] < 0 || params["bw_end"] < 0
            return false, "par must be in [0,1], bw >= 0"
        end
        return true, ""
    else
        return false, "Unknown Harmony Search mode: $mode"
    end
    return true, ""
end

function optimize(ws::HTTP.WebSocket, f_v, method_id::String, client_id::String, request_id::String, params::Dict{String, Any}, cancel_flag::Ref{Bool})
    send_iter = send_optimization_data_closure(ws, client_id, request_id, method_id, cancel_flag)

    lower_bounds = [Float64(p) for p in params["lower_bounds"]]
    upper_bounds = [Float64(p) for p in params["upper_bounds"]]

    @info "Starting optimization" method_id=method_id
    @info "Parameters:" method_id=method_id params=JSON.json(params)
    best_solution, best_fitness = nothing, nothing
    allocated = nothing
    try
        if method_id == "bbo"
            valid, msg = validate_bbo_params(params)
            if !valid
                send_error(ws, client_id, request_id, "BBO params error: $msg")
                return
            end
            iterations_count = params["iterations_count"]
            islands_count = params["islands_count"]
            mutation_probability = params["mutation_probability"]

            blending_rate = params["blending_rate"]
            num_elites = params["num_elites"]

            best_solution, best_fitness = OptimizationAlgorithms.bbo(cancel_flag, f_v, DIMENSION,
                lower_bounds, upper_bounds, iterations_count, islands_count;
                mutation_probability=mutation_probability, blending_rate=blending_rate,
                num_elites=num_elites, send_func=send_iter
            )

        elseif method_id == "cultural"
            valid, msg = validate_cultural_params(params)
            if !valid
                send_error(ws, client_id, request_id, "Cultural params error: $msg")
                return
            end
            population_size = params["population_size"]
            inertia = params["inertia"]
            gamma = params["gamma"]
            num_accepted = params["num_accepted"]
            beta=params["beta"]
            dim = DIMENSION
            max_iters = params["iterations_count"]
            best_solution, best_fitness = OptimizationAlgorithms.cultural_algorithm(cancel_flag,
                f_v, dim, lower_bounds, upper_bounds, max_iters, population_size;
                num_accepted=num_accepted, send_func=send_iter, inertia=inertia, gamma=gamma, beta=beta
            )
        elseif method_id == "harmony"
            valid, msg = validate_harmony_params(params)
            if !valid
               send_error(ws, client_id, request_id, "Harmony params error: $msg")
                return
            end
            dim = DIMENSION
            hms = params["hms"]
            max_iters = params["iterations_count"]
            mode = get(params, "mode", "canonical")
            hmcr = params["hmcr"]

            if mode == "canonical"
                par = params["par"]
                bw = params["bw"]

                best_solution, best_fitness = OptimizationAlgorithms.harmony_search(cancel_flag,
                    f_v, dim, lower_bounds, upper_bounds, max_iters, hms;
                    hmcr=hmcr, par=par, bw=bw, mode="canonical", send_func=send_iter
                )
            elseif mode == "adaptive"
                bw_start = params["bw_start"]
                bw_end = params["bw_end"]
                par_start = params["par_start"]
                par_end = params["par_end"]
                best_solution, best_fitness = OptimizationAlgorithms.harmony_search(cancel_flag,
                    f_v, dim, lower_bounds, upper_bounds, max_iters, hms;
                    mode="adaptive", bw_max=bw_start, bw_min=bw_end, par_min=par_start, par_max=par_end, send_func=send_iter
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
        @info "Optimization completed" client_id=client_id request_id=request_id method_id=method_id best_solution=string(best_solution) best_fitness=best_fitness allocated_bytes=allocated
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
        population
    )
        if ws === nothing || ws.writeclosed
            @warn "WebSocket is closed. Stopping process" client_id=client_id request_id=request_id method_id=method_id
            cancel_flag[]=true
            return
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
                "best_solution" => best_solution
            ))   
            HTTP.WebSockets.send(ws, json_data)
            @debug "Sent iteration data" method_id=method_id iteration=iteration
        catch e
            @error "Error sending iteration data. Stopping process" error=e client_id=client_id request_id=request_id method_id=method_id
            cancel_flag[] = true
        end
    end
end

function warmup()
    f = MathParser.make_function_v2("x^2+y^2")
    
    dim = 2
    lower_bounds = [-5.0, -5.0]
    upper_bounds = [5.0, 5.0]
    cancel_flag = Ref{Bool}(false)
    
    send_func = (iteration, best_fitness, best_solution, population) -> nothing
    
    OptimizationAlgorithms.bbo(
        cancel_flag, f, dim, lower_bounds, upper_bounds, 0,1;
        mutation_probability=0.1, blending_rate=0.0, num_elites=1, send_func=send_func
    )
    
    OptimizationAlgorithms.cultural_algorithm(
        cancel_flag, f, dim, lower_bounds, upper_bounds, 0, 1;
         num_accepted=1, send_func=send_func
    )
    
    OptimizationAlgorithms.harmony_search(
        cancel_flag, f, dim, lower_bounds, upper_bounds, 0, 1;
        hmcr=0.9, par=0.3, bw=0.01, mode="canonical", send_func=send_func
    )
    
    OptimizationAlgorithms.harmony_search(
        cancel_flag, f, dim, lower_bounds, upper_bounds, 0, 1;
        mode="adaptive", send_func=send_func
    )
    
    MathParser.make_function_v2("sin(e*x^2) + cos(y^2) + E")
end

@setup_workload begin
    @compile_workload begin
        warmup()
    end
end
end