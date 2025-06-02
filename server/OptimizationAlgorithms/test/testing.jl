module Testing

using Statistics, Random, Logging

#include("../math.jl")

# sphere: минимум в 0
sphere(x) = sum(x .^ 2)

# rastrigin: минимум в 0
rastrigin(x) = 10length(x) + sum(x .^ 2 .- 10cos.(2π .* x))

schwefel(x) = 418.9829 * length(x) - sum(x .* sin.(sqrt.(abs.(x))))

# Griewank
griewank(x) = sum(x .^ 2) / 4000 - prod(cos.(x ./ sqrt.(1:length(x)))) + 1


function rosenbrock(x)
    return sum(100 * (x[i+1] - x[i]^2)^2 + (1 - x[i])^2 for i in 1:length(x)-1)
end

# ackley: минимум в 0
function ackley(x)
    a, b, c = 20.0, 0.2, 2π
    d = length(x)
    sum1 = sum(x .^ 2)
    sum2 = sum(cos.(c .* x))
    return -a * exp(-b * sqrt(sum1 / d)) - exp(sum2 / d) + a + exp(1)
end


function levy(x)
    w = 1 .+ (x .- 1) ./ 4
    d = length(x)
    term1 = sin(π * w[1])^2
    term3 = (w[end] - 1)^2 * (1 + sin(2 * π * w[end])^2)
    term2 = sum((w[1:d-1] .- 1).^2 .* (1 .+ 10 .* sin.(π .* w[1:d-1] .+ 1).^2))
    return term1 + term2 + term3
end

function michalewicz(x; m=10)
    d = length(x)
    return -sum(sin(x[i]) * (sin(i * x[i]^2 / π))^(2m) for i in 1:d)
end
const test_functions = Dict(
   "Sphere"    => (sphere, 0.0),
    "Rastrigin" => (rastrigin, 0.0),
    "Ackley"    => (ackley, 0.0),
    "Rosenbrock"=> (rosenbrock, 0.0),
    "Schwefel"  => (schwefel, 0.0),
    "Griewank"  => (griewank, 0.0),
    "Levy"      => (levy, 0.0),
   # "Michalewicz" => (michalewicz, -1.8013), # минимум для d=2, m=10

)

bounds_dict = Dict(
    "Sphere"    => (-100.0, 100.0),
    "Rastrigin" => (-5.12, 5.12),
    "Ackley"    => (-32.768, 32.768),
    "Rosenbrock"=> (-30.0, 30.0),
    "Schwefel"  => (-500.0, 500.0),
    "Griewank"  => (-600.0, 600.0),
    "Levy"      => (-10.0, 10.0),
    "Michalewicz" => (0.0, π)
)


function dummy_send(generation, best_fitness, best_individual, population)
    println("Generation $generation | Best Fitness = $best_fitness")
end


function test_algorithm(algorithm_func; 
                        func, 
                        dim=30, 
                        lower_bound=-5.0, 
                        upper_bound=5.0,
                        population_size=50, 
                        max_generations=100, 
                        runs=30, 
                        target_threshold=1e-4,
                        known_solution=nothing,
                        params...)

    results = Float64[]          
    times = Float64[]            
    iterations = Int[]           
    distances_to_target = Float64[]  
    distances_to_solution = Float64[] 
    success_flags = Bool[]      
    solutions = Vector{Float64}[] 

    known_solution = isnothing(known_solution) ? zeros(dim) : known_solution
    known_fitness = func[2]  
    target_fitness = known_fitness+target_threshold  

    for run_id in 1:runs
        cancel_flag = Ref{Bool}(false)
        current_iteration = Ref(0)
        function send_func_closure(iteration, best_fitness, best_solution, population)
            current_iteration[] = iteration
        end

        time = @elapsed begin
            best_sol, best_fit = algorithm_func(
                cancel_flag,
                func[1], 
                dim, 
                fill(lower_bound, dim), 
                fill(upper_bound, dim), 
                max_generations,
                population_size; 
                send_func=send_func_closure,
                target_fitness=target_fitness,
                params...
            )
            
            push!(results, best_fit)
            push!(iterations, current_iteration[])
            push!(solutions, best_sol)
            distance = abs(best_fit - known_fitness)
            push!(distances_to_target, distance)
            push!(success_flags, distance ≤ target_threshold)
            solution_distance = sqrt(sum((best_sol .- known_solution).^2))
            push!(distances_to_solution, solution_distance)
        end

        push!(times, time)
    end


    return (
        mean_fitness=mean(results),
        std_fitness=std(results),
        best_fitness=minimum(results),
        worst_fitness=maximum(results),
        mean_iterations=mean(iterations),
        std_iterations=std(iterations),
        mean_time=mean(times),
        std_time=std(times),
        success_count=count(success_flags),
        success_rate=mean(success_flags),
        mean_distance_to_target=mean(distances_to_target),
        std_distance_to_target=std(distances_to_target),
        mean_distance_to_solution=mean(distances_to_solution),
        std_distance_to_solution=std(distances_to_solution)
    )
end

end