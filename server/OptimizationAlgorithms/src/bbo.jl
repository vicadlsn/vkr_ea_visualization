module BBO

using Random

export bbo

function initialize_population(dim, population_size, lower_bound, upper_bound)
    rand_matrix = rand(dim, population_size)
    return lower_bound .+ (upper_bound .- lower_bound) .* rand_matrix
end

function evaluate_population(population, cost_func)
    return [cost_func(individual) for individual in eachcol(population)]
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

function sort_population(population, fitness)
    indices = sortperm(fitness)
    return population[:, indices], fitness[indices]
end

function bbo(cancel_flag::Ref{Bool}, objective_function, dim, lower_bound, upper_bound, max_generations, population_size; mutation_probability=0.04, blending_rate=0.1, num_elites=2, send_func=nothing, target_fitness=-Inf)
    # Инициализация популяции
    population = initialize_population(dim, population_size, lower_bound, upper_bound)
    fitness = evaluate_population(population, objective_function)
    # Сортировка популяции по пригодности
    population, fitness = sort_population(population, fitness)

    best_fitness = fitness[1]
    best_solution = copy(population[:, 1])

    if send_func !== nothing
        send_func(0, best_fitness, best_solution, collect(eachcol(population)))
    end

    for generation in 1:max_generations
        if cancel_flag[]
            @info "BBO cancelled"
            return best_solution, best_fitness
        end

        if best_fitness <= target_fitness
            if send_func !== nothing
                send_func(generation, best_fitness, best_solution, collect(eachcol(population)))
            end
            return best_solution, best_fitness
        end

        # Вероятности эмиграции и иммиграции
        mu = [(population_size + 1 - i) / (population_size + 1) for i in 1:population_size]
        lambda = 1 .- mu

        # Сохранение элитных решений (оптимизация из генетических алгоритмов)
        elite_solutions = deepcopy(population[:, 1:num_elites])
        elite_fitness = copy(fitness[1:num_elites])
        new_population = copy(population)

        for i in 1:population_size
            # Оператор миграции (с рулеточным отбором)
            for j in 1:dim
                if rand() < lambda[i]
                    selected_index = roulette_wheel_selection(mu)
                    new_population[j, i] = blending_rate * new_population[j, i] + (1 - blending_rate) * population[j, selected_index]
                    new_population[j, i] = clamp(new_population[j, i], lower_bound[j], upper_bound[j]) # если вышли за допустимые границы
                end
            end            

            # оператор мутации
            for j in 1:dim
                if rand() < mutation_probability
                    new_population[j, i] = lower_bound[j] + (upper_bound[j] - lower_bound[j]) * rand()
                    new_population[j, i] = clamp(new_population[j, i], lower_bound[j], upper_bound[j])
                end
            end
        end # для каждой особи миграция + мутация

        # Обновление популяции
        population = new_population
        fitness = evaluate_population(population, objective_function)

        sorted_indices = sortperm(fitness, rev=true)[1:num_elites]
        # Замещение худших особей на элиту из прошлого поколения
        for (k, idx) in enumerate(sorted_indices)
            population[:, idx] = elite_solutions[:, k]
            fitness[idx] = elite_fitness[k]
        end

        # Сортировка популяции по пригодности
        population, fitness = sort_population(population, fitness)

        # Сохранение лучшего решения
        if fitness[1] < best_fitness
            best_fitness = fitness[1]
            best_solution = copy(population[:, 1])
        end

        if send_func !== nothing
            send_func(generation, best_fitness, best_solution, collect(eachcol(population)))
        end
    end

    return best_solution, best_fitness
end

end # BBO