module CA

using Random

include("./ws.jl") 

# Инициализация популяции
function initialize_population(dim, population_size, lower_bound, upper_bound)
    if any(lower_bound .>= upper_bound)
        error("Неверные границы")
    end
    if population_size < 1
        error("Неверный размер популяции")
    end

    return [[lower_bound[j] + (upper_bound[j] - lower_bound[j]) * rand() for j in 1:dim] for _ in 1:population_size]
end

# Оценка популяции
function evaluate_population(population, cost_func)
    return [cost_func(ind) for ind in population]
end

# Сортировка популяции по пригодности
function sort_population(population, fitness)
    indices = sortperm(fitness)
    return population[indices], fitness[indices]
end

# Функция принятия: выбор k лучших особей
function accept(population, fitness, k)
    k = min(k, length(population))
    indices = sortperm(fitness)[1:k]
    return population[indices], fitness[indices]
end

# Инициализация пространства убеждений
function init_belief_space(population, fitness, lower_bound, upper_bound, dim)
    best_idx = argmin(fitness)
    situational = (individual=copy(population[best_idx]), fitness=fitness[best_idx])
    normative = (
        intervals=[[lower_bound[j], upper_bound[j]] for j in 1:dim],
        L=[Inf for _ in 1:dim],
        U=[Inf for _ in 1:dim]
    )
    return situational, normative
end

# Обновление ситуативных знаний
function update_situational(situational, accepted, accepted_fitness)
    best_idx = argmin(accepted_fitness)
    if accepted_fitness[best_idx] < situational.fitness
        return (individual=copy(accepted[best_idx]), fitness=accepted_fitness[best_idx])
    end
    return situational
end

# Обновление нормативных знаний
function update_normative(normative, accepted, accepted_fitness, dim)
    intervals = normative.intervals
    L = normative.L
    U = normative.U
    
    new_intervals = deepcopy(intervals)
    new_L = copy(L)
    new_U = copy(U)
    
    for j in 1:dim
        x_min_j, x_max_j = intervals[j]
        L_j, U_j = L[j], U[j]
        
        for l in eachindex(accepted)
            x_l_j = accepted[l][j]
            f_l = accepted_fitness[l]
            
            # Обновление x_min_j и L_j
            if x_l_j <= x_min_j || f_l < L_j
                x_min_j = x_l_j
                L_j = f_l
            end
            # Обновление x_max_j и U_j
            if x_l_j >= x_max_j || f_l < U_j
                x_max_j = x_l_j
                U_j = f_l
            end
        end
        
        new_intervals[j] = [min(x_min_j, x_max_j), max(x_min_j, x_max_j)]
        new_L[j] = L_j
        new_U[j] = U_j
    end
    
    return (intervals=new_intervals, L=new_L, U=new_U)
end

# Функция влияния: мутация с учетом ситуативных и нормативных знаний
function influence(individual, situational, normative, sigma, dim)
    new_individual = copy(individual)
    
    for j in 1:dim
        s_j = situational.individual[j]
        x_min_j, x_max_j = normative.intervals[j]
        size_j = x_max_j - x_min_j
        
        if individual[j] < s_j
            new_individual[j] += abs(size_j * randn() * sigma)
        elseif individual[j] > s_j
            new_individual[j] -= abs(size_j * randn() * sigma)
        else
            new_individual[j] += size_j * randn() * sigma
        end

        new_individual[j] = clamp(new_individual[j], x_min_j, x_max_j)

    end
    
    return new_individual
end

# Эволюция популяции
function evolve(population, situational, normative, num_elites, population_size, dim, sigma)
    new_population = Vector{Vector{Float64}}(undef, population_size)
    
    # Лучшие особи
    for i in 1:num_elites
        new_population[i] = copy(population[i])
    end
    
    # Пространство убеждений влияет на популяцию
    for i in (num_elites+1):population_size
        new_population[i] = influence(population[i], situational, normative, sigma, dim)
    end
    
    return new_population
end

# Главная функция CA
function cultural_algorithm(ws, task_key, client_id, request_id, cancel_flags::Dict{String, Bool},  objective_function, dim, population_size, lower_bound, upper_bound, max_generations; num_elites=2, num_accepted=10,sigma=1)
    # Валидация 
    if population_size < num_elites || num_accepted > population_size || dim != length(lower_bound) || dim != length(upper_bound)
        error("Неверные параметры: population_size=$population_size, num_elites=$num_elites, num_accepted=$num_accepted, dim=$dim, bounds_length=$(length(lower_bound))")
    end
    
    # 1. Инициализация популяции
    population = initialize_population(dim, population_size, lower_bound, upper_bound)
    fitness = evaluate_population(population, objective_function)
    population, fitness = sort_population(population, fitness)
    
    # 2. Инициализация пространства убеждений
    situational, normative = init_belief_space(population, fitness, lower_bound, upper_bound, dim)

    best_fitness = Inf
    best_solution = nothing
    
    # Основной цикл
    for generation in 1:max_generations
        if get(cancel_flags, task_key, false)
            @info "Cultural Algorithm cancelled" client_id=client_id task_key=task_key
            return best_solution, best_fitness
        end
        
        # 3. Обновление пространства убеждений 
        accepted, accepted_fitness = accept(population, fitness, num_accepted)
        situational = update_situational(situational, accepted, accepted_fitness)
        normative = update_normative(normative, accepted, accepted_fitness, dim)

        # 4. Эволюция популяции
        population = evolve(population, situational, normative, num_elites, population_size, dim, sigma)

        # 5. Оценка популяции
        fitness = evaluate_population(population, objective_function)
        population, fitness = sort_population(population, fitness)
        
        best_fitness = situational.fitness

        # Отправка данных
        send_optimization_data(ws, task_key, client_id, request_id, generation, best_fitness, situational.individual, population)
    end
    
    return best_solution, best_fitness
end

end # CA