module HS

using Random, JSON, WebSockets

include("./ws.jl")

# Инициализация памяти гармоний
function initialize_harmony_memory(dim, hms, lower_bound, upper_bound)
    if any(lower_bound .>= upper_bound)
        error("Неверные границы")
    end
    if hms < 1
        error("Неверный размер памяти гармоний")
    end
    return [lower_bound .+ (upper_bound .- lower_bound) .* rand(dim) for _ in 1:hms]
end

# Вычисление фитнес-функции
function evaluate_harmonies(harmonies, cost_func)
    fitness = Vector{Float64}(undef, length(harmonies))
    for i in 1:length(harmonies)
        fitness[i] = cost_func(harmonies[i])
        if !isfinite(fitness[i])
            error("Non-finite fitness value at harmony $i")
        end
    end
    return fitness
end

# Генерация новой гармонии
# harmonies — память гармоний
# lower_bound, upper_bound — границы поиска
# hmcr — коэффициент памяти гармоний
# par — вероятность настройки высоты
# bw — диапазон настройки
# dim — размерность задачи
function generate_new_harmony(harmonies, lower_bound, upper_bound, hmcr, par, bw, dim)
    new_harmony = Vector{Float64}(undef, dim)
    for j in 1:dim
        if rand() < hmcr
            # Выбор значения из памяти гармоний
            idx = rand(1:length(harmonies))
            new_harmony[j] = harmonies[idx][j]
            # С вероятностью par настраиваем высоту (pitch adjustment)
            if rand() < par
                delta = bw * rand() * (rand(Bool) ? 1 : -1)
                new_harmony[j] += delta
            end
        else
            # Случайное значение в пределах границ
            new_harmony[j] = lower_bound[j] + (upper_bound[j] - lower_bound[j]) * rand()
        end
        # Ограничиваем значение в пределах границ
        new_harmony[j] = clamp(new_harmony[j], lower_bound[j], upper_bound[j])
    end
    return new_harmony
end

# Обновление памяти гармоний
# Заменяем худшую гармонию на новую, если она лучше
function update_harmony_memory!(harmonies, fitness, new_harmony, new_fitness)
    worst_idx = argmax(fitness)
    if new_fitness < fitness[worst_idx]
        harmonies[worst_idx] = copy(new_harmony)
        fitness[worst_idx] = new_fitness
    end
    return harmonies, fitness
end


function harmony_search(ws, task_key, client_id, request_id, cancel_flags::Dict{String, Bool},
                        objective_function, dim::Int, 
                        lower_bound::Vector{Float64}, upper_bound::Vector{Float64}, 
                        max_iterations::Int, hms::Int;
                        hmcr=0.9, par=0.3, bw=0.01,
                        mode::String = "canonical")  # "adaptive" или "canonical"

    # Проверка входных параметров
    if hms < 1 || dim != length(lower_bound) || dim != length(upper_bound)
        error("Неверные параметры: hms=$hms, dim=$dim, bounds_length=$(length(lower_bound))")
    end
    if !(0 <= hmcr <= 1)
        error("Неверный HMCR: $hmcr")
    end

    # Инициализация памяти гармоний и оценка
    harmonies = initialize_harmony_memory(dim, hms, lower_bound, upper_bound)
    fitness = evaluate_harmonies(harmonies, objective_function)

    best_fitness = fitness[1]
    best_solution = harmonies[1]
    current_best_fitness = fitness[1]
    current_best_solution = harmonies[1]

    for iteration in 1:max_iterations
        if get(cancel_flags, task_key, false)
            @info "HS cancelled" client_id=client_id task_key=task_key
            return best_solution, best_fitness
        end

        # Адаптивное изменение параметров, если выбран режим "adaptive"
        if mode == "adaptive"
            # par увеличивается линейно с 0.01 до 0.99
            par = 0.01 + (0.99 - 0.01) * (iteration / max_iterations)
            # bw экспоненциально уменьшается с 5% до 0.01% поискового пространства
            full_range = upper_bound .- lower_bound
            bw = full_range .* (0.05 .* exp(-5 * iteration / max_iterations))  # вектор bw по каждой размерности
        end

        # Создание новой гармонии
        new_harmony = Vector{Float64}(undef, dim)
        for j in 1:dim
            if rand() < hmcr
                idx = rand(1:hms)
                new_harmony[j] = harmonies[idx][j]
                if rand() < par
                    if mode == "adaptive"
                        # Гауссовская мутация (адаптивный режим)
                        new_harmony[j] += randn() * bw[j]
                    else
                        # Классическая мутация
                        delta = bw * rand() * (rand(Bool) ? 1 : -1)
                        new_harmony[j] += delta
                    end
                end
            else
                new_harmony[j] = lower_bound[j] + (upper_bound[j] - lower_bound[j]) * rand()
            end
            new_harmony[j] = clamp(new_harmony[j], lower_bound[j], upper_bound[j])
        end

        new_fitness = objective_function(new_harmony)

        # Обновление памяти гармоний
        harmonies, fitness = update_harmony_memory!(harmonies, fitness, new_harmony, new_fitness)

        # Лучшее решение
        best_idx = argmin(fitness)
        current_best_fitness = fitness[best_idx]
        current_best_solution = harmonies[best_idx]
        if current_best_fitness < best_fitness
            best_fitness = current_best_fitness
            best_solution = current_best_solution
        end

        send_optimization_data(ws, task_key, client_id, request_id, iteration, best_fitness, best_solution, current_best_fitness, current_best_solution, harmonies)
    end

    return best_solution, best_fitness
end


end # module HS