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
function generate_new_harmony(harmonies, lower_bound, upper_bound, hmcr, par, bw, dim,mode::String)
    new_harmony = Vector{Float64}(undef, dim)
    for j in 1:dim
        if rand() < hmcr
            # Выбор значения из памяти гармоний
            idx = rand(1:length(harmonies))
            new_harmony[j] = harmonies[idx][j]
            # С вероятностью par настраиваем высоту (pitch adjustment)
            if rand() < par
                if mode == "adaptive"
                    # Гауссовская мутация в адаптивном режиме
                    bw_j = bw[j] # Используем bw для каждой размерности
                    new_harmony[j] += randn() * bw_j
                else
                    # Каноническая мутация (равномерное распределение)
                    #delta = bw * rand() * (rand(Bool) ? 1 : -1)
                    delta = bw * (2 * rand() - 1) # Возмущение в [-bw, bw]
                    new_harmony[j] += delta
                end
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


function harmony_search(ws, task_key, client_id, request_id, cancel_flag::Ref{Bool},
                        objective_function, dim::Int, 
                        lower_bound::Vector{Float64}, upper_bound::Vector{Float64}, 
                        max_iterations::Int, hms::Int;
                        hmcr=0.9, par=0.3, bw=0.01,
                        mode::String = "canonical",send_func=nothing)  # "adaptive" или "canonical"

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

    best_idx = argmin(fitness)
    best_fitness = fitness[best_idx]
    best_solution = copy(harmonies[best_idx])

    for iteration in 1:max_iterations
        if cancel_flag[]
            @info "HS cancelled" client_id=client_id task_key=task_key
            return best_solution, best_fitness
        end

        # Адаптивное изменение параметров, если выбран режим "adaptive"
        current_par = par
        current_bw = bw
        if mode == "adaptive"
            # Линейное увеличение par от 0.01 до 0.99
            current_par = 0.01 + (0.99 - 0.01) * (iteration / max_iterations)
            # Экспоненциальное уменьшение bw от 5% до 0.01% диапазона поиска
            full_range = upper_bound .- lower_bound
            current_bw = full_range .* (0.05 .* exp(-5 * iteration / max_iterations))
        end

        # Создание новой гармонии
        new_harmony = generate_new_harmony(harmonies, lower_bound, upper_bound, hmcr, current_par, 
        current_bw, dim, mode)
        new_fitness = objective_function(new_harmony)

        # Обновление памяти гармоний
        harmonies, fitness = update_harmony_memory!(harmonies, fitness, new_harmony, new_fitness)

        # Обновление лучшего решения
        best_idx = argmin(fitness)
        current_best_fitness = fitness[best_idx]
        current_best_solution = harmonies[best_idx]
        if current_best_fitness < best_fitness
            best_fitness = current_best_fitness
            best_solution = copy(current_best_solution)
        end

        if send_func !== nothing
            send_func(ws, task_key, client_id, request_id, iteration, best_fitness, best_solution, current_best_fitness, current_best_solution, harmonies)
        end
    end

    return best_solution, best_fitness
end


end # module HS