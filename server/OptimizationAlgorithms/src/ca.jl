module CA

using Random

export cultural_algorithm

function initialize_population(dim, population_size, lower_bound, upper_bound)
    rand_matrix = rand(dim, population_size)
    return lower_bound .+ (upper_bound .- lower_bound) .* rand_matrix
end

function evaluate_population(population, cost_func)
    return [cost_func(individual) for individual in eachcol(population)]
end

function sort_population(population::Matrix{Float64}, fitness::Vector{Float64})
    indices = sortperm(fitness)
    return population[:, indices], fitness[indices]
end

function update_belief_space!(belief_space::Vector{Tuple{Float64, Float64}},
                              accepted::Matrix{Float64}, inertia::Float64)
    dim = size(accepted, 1)
    for i in 1:dim
        values = accepted[i, :]
        x_min = minimum(values)
        x_max = maximum(values)
        b_min, b_max = belief_space[i]
        new_min = inertia * b_min + (1 - inertia) * x_min
        new_max = inertia * b_max + (1 - inertia) * x_max
        belief_space[i] = (new_min, new_max)
    end
end

function adjust_solution_CAEP(solution::Vector{Float64}, belief_space, lower_bound, upper_bound, gamma, f, beta, min_f, range_f)
    dim = length(solution)
    new_solution = copy(solution)
    for k in 1:dim
        Bmin, Bmax = belief_space[k]
        delta = 0.0
        if solution[k] < Bmin
            delta = Bmin - solution[k]
        elseif solution[k] > Bmax
            delta = Bmax - solution[k]
        end
        r = randn()
        fval = (f(solution) - min_f) / range_f
        new_solution[k] = solution[k] + r * (abs(fval * beta + gamma))^0.5 + delta
        new_solution[k] = clamp(new_solution[k], lower_bound[k], upper_bound[k])
    end
    return new_solution
end

function binary_tournament_selection(population,
                                     fitness,
                                     new_size)
    dim, total_size = size(population)
    new_population = Matrix{Float64}(undef, dim, new_size)
    new_fitness = Vector{Float64}(undef, new_size)

    best_idx = argmin(fitness)
    new_population[:, 1] = population[:, best_idx]
    new_fitness[1] = fitness[best_idx]

    for i in 2:new_size
        idxs = rand(1:total_size, 2)
        winner_idx = idxs[argmin(fitness[idxs])]
        new_population[:, i] = population[:, winner_idx]
        new_fitness[i] = fitness[winner_idx]
    end

    return new_population, new_fitness
end

function cultural_algorithm(cancel_flag::Ref{Bool}, objective_function, dim::Int, lower_bound::Vector{Float64}, upper_bound::Vector{Float64}, max_generations::Int, population_size::Int;
num_accepted=round(Int, 0.2 * population_size), inertia=0.5, gamma=1.0, send_func=nothing, target_fitness=-Inf,beta=0.0)
    population = initialize_population(dim, population_size, lower_bound, upper_bound)
    fitness = evaluate_population(population, objective_function)
    population, fitness = sort_population(population, fitness)

    best_solution, best_fitness = copy(population[:, 1]), fitness[1]

    belief_space = [(lower_bound[i], upper_bound[i]) for i in 1:dim]

    target_achieved = false
    min_iters = max_generations

    for generation in 1:max_generations
        if cancel_flag[]
            @info "Cultural Algorithm cancelled"
            return best_solution, best_fitness
        end

        new_population = Matrix{Float64}(undef, dim, population_size)
        fitness_values = [objective_function(population[:, i]) for i in 1:population_size]
        min_f = minimum(fitness_values)
        max_f = maximum(fitness_values)
        range_f = max_f - min_f + eps()

        for i in 1:population_size
            new_population[:, i] = adjust_solution_CAEP(population[:, i], belief_space,
                lower_bound, upper_bound, gamma, objective_function, beta, min_f, range_f)
        end

        combined_population = hcat(population, new_population)
        combined_fitness = evaluate_population(combined_population, objective_function)

        new_population, new_fitness = binary_tournament_selection(combined_population, combined_fitness, population_size)

        population = new_population
        fitness = new_fitness
        population, fitness = sort_population(population, fitness)

        accepted = population[:, 1:num_accepted]
        update_belief_space!(belief_space, accepted, inertia)

        if fitness[1] < best_fitness
            best_fitness = fitness[1]
            best_solution = copy(population[:, 1])
        end

        if send_func !== nothing
            send_func(generation, best_fitness, best_solution, [population[:, i] for i in 1:population_size])
        end

        if !target_achieved && best_fitness <= target_fitness
            target_achieved = true
            min_iters = generation
        end
    end


    if target_fitness > -Inf
        send_func(min_iters, best_fitness, best_solution, collect(eachcol(population)))
    end
    return best_solution, best_fitness
end

end  # module CA