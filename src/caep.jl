module CAEP

using Random

include("./ws.jl")

# Инициализация популяции
function initialize_population(dim, population_size, lower_bound, upper_bound)
    return [[lower_bound[j] + rand() * (upper_bound[j] - lower_bound[j]) for j in 1:dim]
            for _ in 1:population_size]
end

# Оценка приспособленности популяции
function evaluate_population(population, cost_func)
    return [cost_func(ind) for ind in population]
end

# Сортировка популяции по значению функции
function sort_population(population, fitness)
    indices = sortperm(fitness)
    return population[indices], fitness[indices]
end

# Обновление belief space с инерцией α
function update_belief_space!(belief_space::Vector{Tuple{Float64, Float64}},
                              accepted::Vector{Vector{Float64}}, α::Float64)
    dim = length(accepted[1])
    for i in 1:dim
        values = [ind[i] for ind in accepted]
        x_min = minimum(values)
        x_max = maximum(values)
        b_min, b_max = belief_space[i]
        new_min = α * b_min + (1 - α) * x_min
        new_max = α * b_max + (1 - α) * x_max
        belief_space[i] = (new_min, new_max)
    end
end

# Корректировка особи с учётом belief space (уравнение 15.3)
function adjust_solution_CAEP(solution, belief_space, lower_bound, upper_bound, γ)
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
        r = randn()  # стандартное нормальное распределение
        new_solution[k] += r * γ + delta
        new_solution[k] = clamp(new_solution[k], lower_bound[k], upper_bound[k])
    end
    return new_solution
end

# Главный алгоритм CAEP
function cultural_algorithm(ws, task_key, client_id, request_id, cancel_flags::Dict{String, Bool}, objective_function, dim, population_size, lower_bound, upper_bound, max_generations;
num_accepted=round(Int, 0.2 * population_size), β=0.3, γ=0.1)

    population = initialize_population(dim, population_size, lower_bound, upper_bound)
    fitness = evaluate_population(population, objective_function)
    population, fitness = sort_population(population, fitness)

    best_solution, best_fitness = population[1], fitness[1]

    # Инициализация belief space
    belief_space = [(lower_bound[i], upper_bound[i]) for i in 1:dim]

    for generation in 1:max_generations
        if get(cancel_flags, task_key, false)
            @info "CAEP cancelled" client_id=client_id task_key=task_key
            return best_solution, best_fitness
        end

        # Отбор лучших решений
        accepted = population[1:num_accepted]

        # Обновление belief space с инерцией
        update_belief_space!(belief_space, accepted, β)

        # Мутация популяции с учётом belief space
        new_population = [adjust_solution_CAEP(population[i], belief_space,
                                               lower_bound, upper_bound, γ)
                          for i in 1:population_size]

        population = new_population
        fitness = evaluate_population(population, objective_function)
        population, fitness = sort_population(population, fitness)

        best_solution, best_fitness = population[1], fitness[1]

        println("Поколение $generation: Лучшее значение = $(best_fitness)")

        send_optimization_data(ws, task_key, client_id, request_id,
                               generation, best_fitness, best_solution, population)
    end

    return best_solution, best_fitness
end

end  # module CAEP
