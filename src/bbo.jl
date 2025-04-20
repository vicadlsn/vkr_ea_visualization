module BBO

using Random, Base.Threads

include("./ws.jl")

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
function remove_duplicates!(population, fitness, lower_bound, upper_bound)
    seen = Set{Vector{Float64}}()
    for i in eachindex(population)
        if population[i] in seen
            population[i] = lower_bound[i] .+ (upper_bound[i] - lower_bound[i]) .* rand(length(population[i]))
            fitness[i] = Inf
        else
            push!(seen, population[i])
        end
    end
end

function sort_population(population, fitness)
    indices = sortperm(fitness)
    return population[indices], fitness[indices]
end

function bbo(ws, cancel_flags::Dict{String, Bool}, tab_id::String, lock, objective_function, dim, population_size, lower_bound, upper_bound, max_generations, mutation_probability, alpha=0, num_elites=2, duplicate_removal_interval=10)
    #lock(lock) do
    cancel_flags[tab_id] = false  # Сбрасываем флаг отмены
    #end
    # Инициализация популяции
    population = initialize_population(dim, population_size, lower_bound, upper_bound)
    fitness = evaluate_population(population, objective_function)

    # Сортировка популяции по пригодности
    population, fitness = sort_population(population, fitness)

    best_fitness = Float64[]
    best_solution = nothing

    for generation in 1:max_generations
        # Вероятности эмиграции и иммиграции
        mu = [(population_size + 1 - i) / (population_size + 1) for i in 1:population_size]
        lambda = [1 - m for m in mu]

        # Сохранение элитных решений (оптимизация из генетических алгоритмов)
        elite_solutions = deepcopy(population[1:num_elites])
        elite_fitness = fitness[1:num_elites]

        new_population = deepcopy(population)

        for i in 1:population_size
            # Оператор миграции (с рулеточным отбором)
            for j in 1:dim
                if rand() < lambda[i]
                    selected_index = roulette_wheel_selection(mu)
                    new_population[i][j] = alpha * new_population[i][j] + (1-alpha)*population[selected_index][j]
                end
            end            

            # оператор мутации
            for j in 1:dim
                if rand() < mutation_probability
                    new_population[i][j] = lower_bound[j] + (upper_bound[j] - lower_bound[j]) * rand()
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

        # Удаление дубликатов через заданное количество итераций
        #if generation % duplicate_removal_interval == 0
        #    remove_duplicates!(population, fitness, lower_bound, upper_bound)
        #end

        # Сортировка популяции по пригодности
        population, fitness = sort_population(population, fitness)

        # Сохранение лучшего решения
        push!(best_fitness, fitness[1])
        best_solution = population[1]

        # Отображение результатов по итерациям
        println("Поколение $generation: Лучшее значение = $(fitness[1])")

        #lock(lock) do
            if cancel_flags[tab_id]
                println("Optimization in tab $tab_id cancelled.")
                return 
            end
       # end

        try
            send_optimization_data(ws, tab_id, "bbo", generation, best_fitness[end], best_solution, population)
            sleep(0.1)
        catch e
            println("failed send message to client")
            return
        end
    end

    return best_solution, best_fitness
end

end # BBO