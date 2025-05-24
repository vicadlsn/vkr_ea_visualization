module Testing

using Statistics

include("../math.jl")

# sphere: минимум в 0
sphere(x) = sum(x .^ 2)

# rastrigin: минимум в 0
rastrigin(x) = 10length(x) + sum(x .^ 2 .- 10cos.(2π .* x))

schwefel(x) = 418.9829 * length(x) - sum(x .* sin.(sqrt.(abs.(x))))

# Griewank
griewank(x) = sum(x .^ 2) / 4000 - prod(cos.(x ./ sqrt.(1:length(x)))) + 1

# Easom (только для 2D)
easom(x) = -cos(x[1]) * cos(x[2]) * exp(-(x[1]-π)^2 - (x[2]-π)^2)

function rosenbrock(x)
    return sum(100 * (x[i+1] - x[i]^2)^2 + (1 - x[i])^2 for i in 1:length(x)-1)
end

# Schaffer F6 (только для 2D)
function schaffer_f6(x)
    x1, x2 = x[1], x[2]
    num = sin(sqrt(x1^2 + x2^2))^2 - 0.5
    denom = (1 + 0.001 * (x1^2 + x2^2))^2
    return 0.5 + num / denom
end

# ackley: минимум в 0
function ackley(x)
    a, b, c = 20.0, 0.2, 2π
    d = length(x)
    sum1 = sum(x .^ 2)
    sum2 = sum(cos.(c .* x))
    return -a * exp(-b * sqrt(sum1 / d)) - exp(sum2 / d) + a + exp(1)
end
"""

sphere = "x^2 + y^2"
rastrigin = "20 + (x^2 - 10*cos(2*pi*x)) + (y^2 - 10*cos(2*pi*y))"
ackley = "-20 * exp(-0.2 * sqrt(0.5*(x^2 + y^2))) - exp(0.5 * (cos(2*pi*x) + cos(2*pi*y))) + 20 + exp(1)"
rosenbrock = "100*(y - x^2)^2 + (1 - x)^2"
schwefel = "418.9829*2 - (x*sin(sqrt(abs(x))) + y*sin(sqrt(abs(y))))"
griewank = "(x^2 + y^2)/4000 - cos(x)*cos(y/sqrt(2)) + 1"
easom = "-cos(x)*cos(y)*exp(-((x - pi)^2 + (y - pi)^2))"
schaffer_f6 = "0.5 + (sin(sqrt(x^2 + y^2))^2 - 0.5)/((1 + 0.001*(x^2 + y^2))^2)"
"""
test_functions = Dict(
    "Sphere" => sphere,
    "Rastrigin" => rastrigin,
    "Ackley" => ackley,
    "Rosenbrock" => rosenbrock,
    "Schwefel" => schwefel,
    "Griewank" => griewank,
    "Easom" => easom,
    "SchafferF6" => schaffer_f6
)

bounds_dict = Dict(
    "Sphere"      => (-100.0, 100.0),
    "Rastrigin"   => (-5.12, 5.12),
    "Ackley"      => (-32.768, 32.768),
    "Rosenbrock"  => (-30.0, 30.0),
    "Schwefel"    => (-500.0, 500.0),
    "Griewank"    => (-600.0, 600.0),
    "Easom"       => (-100.0, 100.0),
    "SchafferF6"  => (-100.0, 100.0)
)



function dummy_send(ws, task_key, client_id, request_id, generation, best_fitness, best_individual, population)
    println("Generation $generation | Best Fitness = $best_fitness")
end


function test_algorithm(algorithm_func; func, dim=30, lower_bound=-5.0, upper_bound=5.0,
                        population_size=50, max_generations=100, runs=30, params...)
    results = Float64[]

    for _ in 1:runs
        cancel_flags = Dict{String, Bool}()  # пустой словарь, т.к. отмена не используется
        ws = nothing  # вебсокет не нужен для теста
        task_key = "test"
        client_id = "offline"
        request_id = "local"

        # запускаем алгоритм
        best_sol, best_fit = algorithm_func(ws, task_key, client_id, request_id, cancel_flags,
        func, dim, 
                                            fill(lower_bound, dim), fill(upper_bound, dim),
                                            max_generations,population_size; params...)
        push!(results, best_fit)
    end

    return (mean=mean(results), std=std(results), best=minimum(results), worst=maximum(results))
end


end