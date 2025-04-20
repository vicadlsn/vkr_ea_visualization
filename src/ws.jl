using HTTP
using JSON

function send_optimization_data(ws, tab_id, method_name, iteration, best_fitness, best_solution, population)
    data = Dict(
        "tab_id" => tab_id,
        "method" => method_name,
        "iteration" => iteration,
        "population" => population,
        "best_fitness" => best_fitness,
        "best_solution" => best_solution
    )
    try
        HTTP.send(ws, JSON.json(data))
    catch e 
        println("Error sending message to client: ", e)
    end
end   