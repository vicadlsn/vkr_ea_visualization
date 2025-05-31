module CA

using Random

export cultural_algorithm

# Инициализация популяции: dim × population_size
function initialize_population(dim, population_size, lower_bound, upper_bound)
    rand_matrix = rand(dim, population_size)
    return lower_bound .+ (upper_bound .- lower_bound) .* rand_matrix
end

# Оценка приспособленности популяции
function evaluate_population(population, cost_func)
    return [cost_func(individual) for individual in eachcol(population)]
end

# Сортировка популяции по значению функции
function sort_population(population::Matrix{Float64}, fitness::Vector{Float64})
    indices = sortperm(fitness)
    return population[:, indices], fitness[indices]
end

# Обновление belief space с инерцией inertia
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

# Корректировка особи с учётом belief space
function adjust_solution_CAEP(solution::Vector{Float64}, belief_space, lower_bound, upper_bound, dispersion)
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
        new_solution[k] += r * dispersion^0.5 + delta
        new_solution[k] = clamp(new_solution[k], lower_bound[k], upper_bound[k])
    end
    return new_solution
end

# Бинарный турнир для выбора из объединённой популяции
function binary_tournament(combined::Matrix{Float64}, fitness::Vector{Float64}, population_size::Int)
    dim = size(combined, 1)
    new_population = Matrix{Float64}(undef, dim, population_size)
    for i in 1:population_size
        i1, i2 = rand(1:length(fitness), 2)
        winner = fitness[i1] < fitness[i2] ? i1 : i2
        new_population[:, i] = combined[:, winner]
    end
    return new_population
end

#CAEP
function cultural_algorithm(cancel_flag::Ref{Bool}, objective_function, dim::Int, lower_bound::Vector{Float64}, upper_bound::Vector{Float64}, max_generations::Int, population_size::Int;
num_accepted=round(Int, 0.2 * population_size), num_elites=2, inertia=0.5, dispersion=1.0, send_func=nothing, scale_factor=1, target_fitness=-Inf)
    num_elites = min(num_elites, population_size)
    population = initialize_population(dim, population_size, lower_bound, upper_bound)
    fitness = evaluate_population(population, objective_function)
    population, fitness = sort_population(population, fitness)

    best_solution, best_fitness = copy(population[:, 1]), fitness[1]

    # Инициализация belief space
    belief_space = [(lower_bound[i], upper_bound[i]) for i in 1:dim]

    for generation in 1:max_generations
        if cancel_flag[]
            @info "Cultural Algorithm cancelled"
            return best_solution, best_fitness
        end

        if best_fitness <= target_fitness
            if send_func !== nothing
                send_func(generation, best_fitness, best_solution, [population[:, i] for i in 1:population_size])
            end
            return best_solution, best_fitness
        end

        # Мутация популяции с учётом belief space
        new_population = Matrix{Float64}(undef, dim, population_size)
        for i in 1:population_size
            new_population[:, i] = adjust_solution_CAEP(population[:, i], belief_space,
                                                        lower_bound, upper_bound, dispersion)
        end
        
        population = new_population
        fitness = evaluate_population(new_population, objective_function)

        #combined = hcat(population, new_population)
        #combined_fitness = vcat(fitness, new_fitness)
        #population = binary_tournament(combined, combined_fitness, population_size)
        #fitness = evaluate_population(population, objective_function)
        
        population, fitness = sort_population(population, fitness)

        # Отбор лучших решений
        accepted = population[:, 1:num_accepted]
        # Обновление belief space с инерцией
        update_belief_space!(belief_space, accepted, inertia)
        
        if fitness[1] < best_fitness
            best_fitness = fitness[1]
            best_solution = copy(population[:, 1])
        end

        if send_func !== nothing
            send_func(generation, best_fitness, best_solution, [population[:, i] for i in 1:population_size])
        end
    end

    return best_solution, best_fitness
end

end  # module CA