using HTTP
using Sockets
using JSON
using GeneralizedGenerated
using Base.Threads
using Logging

include("./bbo.jl")

const LOCALIP = "127.0.0.1" #string(Sockets.getipaddr())
const HTTP_PORT = 9000

function handle_ws_client(http::HTTP.Stream, optimizations::Dict{String, Task}, cancel_flags::Dict{String, Bool}, lock::ReentrantLock)
    HTTP.WebSockets.upgrade(http) do ws
        for msg in ws
            @info "received message: " msg
            data = []
            try
                data = JSON.parse(String(msg))
                println("Parsed JSON: ", data)
            catch e
                println("Error parsing JSON: ", e)
                send(ws, "Error: Invalid JSON")
                continue
            end

            if data["action"] == "start"
            
                f_expr = data["function"]
                f = nothing
                f_wrapped = nothing
                try
                    f = mk_function(:( (x, y) -> $((Meta.parse(f_expr))) ))
                    f_wrapped =  v -> f(v[1], v[2])
                catch e
                    println("Failed to parse function ", f_expr)
                    send(ws, "Error: Invalid function")
                    continue
                end

                params = data["params"]
                params["population_size"] = data["population_size"]
                params["lower_bounds"] = data["lower_bounds"]
                params["upper_bounds"] = data["upper_bounds"]
                params["iterations_count"] = data["iterations_count"]
                method = data["method"]
                tab_id = data["tab_id"]

            # lock(lock) do
                    if haskey(optimizations, tab_id)
                        cancel_flags[tab_id] = true
                        wait(optimizations[tab_id]) # ожидаем завершения старой задачи
                    end

                    optimizations[tab_id] = @async optimize(ws, f_wrapped, tab_id, method, params,cancel_flags, lock)

                #end
            elseif data["action"] == "stop"
                tab_id = data["tab_id"]
                if haskey(optimizations, tab_id)
                    cancel_flags[tab_id] = true
                    wait(optimizations[tab_id]) # ожидаем завершения старой задачиe
                end
            end
            
        end
    end
end

function optimize(ws::HTTP.WebSocket, f_wrapped, tab_id::String, method::String, params::Dict{String, Any}, cancel_flags::Dict{String, Bool}, lock::ReentrantLock)
    if method == "bbo"
        BBO.bbo(ws, cancel_flags, tab_id, lock, f_wrapped, 2, params["population_size"], params["lower_bounds"], params["upper_bounds"], params["iterations_count"], params["mutation_probability"], params["blending_rate"])
    elseif method == "cultural"
        BBO.bbo(ws, cancel_flags, tab_id, lock, f_wrapped, 2, params["population_size"], params["lower_bounds"], params["upper_bounds"], params["iterations_count"], 0.1, 0)
    end
end
