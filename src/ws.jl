using HTTP
using JSON

function send_optimization_data(ws, method_id, client_id, request_id, iteration, best_fitness, best_solution, current_best_fitness, current_best_solution, population)
    data = Dict(
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
    )
    try
        HTTP.send(ws, JSON.json(data))
        @debug "Sent data" method_id=method_id iteration=iteration
    catch e
        @error "Error sending iteration data: $e" method_id=method_id
    end
end   
