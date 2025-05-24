module BBO

using Random

export bbo

function initialize_population(dim, population_size, lower_bound, upper_bound)
   # return [lower_bound .+ (upper_bound-lower_bound) * rand(dim) for _ in 1:population_size]
   return [[lower_bound[j] + (upper_bound[j] - lower_bound[j]) * rand() for j in 1:dim] for _ in 1:population_size]
end

function evaluate_population(population, cost_func)
    return [cost_func(ind) for ind in population]
end

# Рулеточный отбор на основе накопленных вероятностей
function roulette_wheel_selection(mu)
    total = sum(mu)
    r = rand() * total
    cumulative = 0.0
    for i in eachindex(mu)
        cumulative += mu[i]
        if r <= cumulative
            return i
        end
    end
    return length(mu)  # на случай пограничного значения
end

# Удаление дубликатов через каждые несколько итераций
"""function remove_duplicates!(population, fitness, lower_bound, upper_bound)
    seen = Set{UInt64}()
    for i in eachindex(population)
        h = hash(population[i])
        if h in seen
            population[i] = lower_bound[i] .+ (upper_bound[i] - lower_bound[i]) .* rand(length(population[i]))
            fitness[i] = Inf
        else
            push!(seen, h)
        end
    end
end
"""
function sort_population(population, fitness)
    indices = sortperm(fitness)
    return population[indices], fitness[indices]
end

function bbo(cancel_flag::Ref{Bool}, objective_function, dim, lower_bound, upper_bound, max_generations, population_size; mutation_probability=0.04, blending_rate=0.1, num_elites=2, send_func=nothing)
    # Инициализация популяции
    population = initialize_population(dim, population_size, lower_bound, upper_bound)
    fitness = evaluate_population(population, objective_function)

    # Сортировка популяции по пригодности
    population, fitness = sort_population(population, fitness)

    best_fitness = fitness[1]
    best_solution = population[1]
    current_best_fitness = fitness[1]
    current_best_solution = population[1]

    for generation in 1:max_generations
        if cancel_flag[]
            @info "BBO cancelled"
            return best_solution, best_fitness
        end

        # Вероятности эмиграции и иммиграции
        mu = [(population_size + 1 - i) / (population_size + 1) for i in 1:population_size]
        lambda = 1 .- mu

        # Сохранение элитных решений (оптимизация из генетических алгоритмов)
        elite_solutions = deepcopy(population[1:num_elites])
        elite_fitness = fitness[1:num_elites]

        new_population = deepcopy(population)

        for i in 1:population_size
            # Оператор миграции (с рулеточным отбором)
            for j in 1:dim
                if rand() < lambda[i]
                    selected_index = roulette_wheel_selection(mu)
                    new_population[i][j] = blending_rate * new_population[i][j] + (1-blending_rate)*population[selected_index][j]
                    new_population[i][j] = clamp(new_population[i][j], lower_bound[j], upper_bound[j]) # если вышли за допустимые границы

                end
            end            

            # оператор мутации
            for j in 1:dim
                if rand() < mutation_probability
                    new_population[i][j] = lower_bound[j] + (upper_bound[j] - lower_bound[j]) * rand()
                    new_population[i][j] = clamp(new_population[i][j], lower_bound[j], upper_bound[j]) # если вышли за допустимые границы

                end
            end
        end # для каждой особи миграция + мутация

        # Обновление популяции
        population = new_population
        fitness = evaluate_population(population, objective_function)
        population, fitness = sort_population(population, fitness)

        # Замещение худших особей на элиту из прошлого поколения
        for i in 1:num_elites
            population[end - i + 1] = elite_solutions[i]
            fitness[end - i + 1] = elite_fitness[i]
        end

        # Сортировка популяции по пригодности
        population, fitness = sort_population(population, fitness)

        # Сохранение лучшего решения
        current_best_fitness = fitness[1]
        current_best_solution = population[1]
        if current_best_fitness < best_fitness
            best_fitness = current_best_fitness
            best_solution = current_best_solution
        end

       
        if send_func !== nothing
            send_func(generation, best_fitness, best_solution, current_best_fitness, current_best_solution, population)
        end
    end

    return best_solution, best_fitness
end

end # BBO