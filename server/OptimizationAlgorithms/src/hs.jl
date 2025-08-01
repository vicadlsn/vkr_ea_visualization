module HS

using Random

export harmony_search

function initialize_harmony_memory(dim::Int, hms::Int, lower_bound, upper_bound)
    rand_matrix = rand(dim, hms)
    return lower_bound .+ (upper_bound .- lower_bound) .* rand_matrix
end

function evaluate_harmonies(harmonies::Matrix{Float64}, cost_func)
    return [cost_func(h) for h in eachcol(harmonies)]
end


function generate_new_harmony(harmonies::Matrix{Float64}, lower_bound, upper_bound, hmcr::Float64, par::Float64, bw, dim::Int, mode::String)
    new_harmony = Vector{Float64}(undef, dim)
    hms = size(harmonies, 2)

    for j in eachindex(lower_bound)
        if rand() < hmcr
            # Выбор значения из памяти гармоний
            idx = rand(1:hms)
            new_harmony[j] = harmonies[j, idx]
            # С вероятностью par настраиваем высоту
            if rand() < par
                delta = (mode == "adaptive" ? bw[j] : bw) * (2 * rand() - 1)
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

# Обновление памяти гармоний, заменяем худшую гармонию на новую, если она лучше
function update_harmony_memory!(harmonies::Matrix{Float64}, fitness::Vector{Float64},
                                new_harmony::Vector{Float64}, new_fitness::Float64)
    worst_idx = argmax(fitness)
    if new_fitness < fitness[worst_idx]
        harmonies[:, worst_idx] = new_harmony
        fitness[worst_idx] = new_fitness
    end
end


function harmony_search(cancel_flag::Ref{Bool},
                        objective_function, dim::Int, 
                        lower_bound, upper_bound, 
                        max_iterations::Int, hms::Int;
                        hmcr=0.9, par=0.3, bw=0.01, 
                        bw_max = 0.05,
                        bw_min = 0.0001,
                        par_min = 0.01,
                        par_max = 0.99,
                        mode::String = "canonical",send_func=nothing,target_fitness=-Inf)  # mode "adaptive" или "canonical"

    harmonies = initialize_harmony_memory(dim, hms, lower_bound, upper_bound)
    fitness = evaluate_harmonies(harmonies, objective_function)

    best_idx = argmin(fitness)
    best_solution = copy(harmonies[:, best_idx])
    best_fitness = fitness[best_idx]

    if send_func !== nothing
        send_func(0, best_fitness, best_solution, collect(eachcol(harmonies)))
    end

    target_achieved = false
    min_iters = max_iterations
    for iteration in 1:max_iterations
        if cancel_flag[]
            @info "HS cancelled"
            return best_solution, best_fitness
        end

        current_par = par
        current_bw = bw
        if mode == "adaptive"
            # Линейное увеличение par
            current_par = par_min + (par_max - par_min) * (iteration / max_iterations)
            # Экспоненциальное уменьшение bw
            full_range = upper_bound .- lower_bound
            current_bw = full_range .* (bw_max * exp(log(bw_min/bw_max) * iteration / max_iterations))
        end

        # Создание новой гармонии
        new_harmony = generate_new_harmony(harmonies, lower_bound, upper_bound,
                                           hmcr, current_par, current_bw, dim, mode)
        new_fitness = objective_function(new_harmony)

        # Обновление памяти гармоний
        update_harmony_memory!(harmonies, fitness, new_harmony, new_fitness)

        current_best_idx = argmin(fitness)
        current_best_fitness = fitness[current_best_idx]

        if current_best_fitness < best_fitness
            best_fitness = current_best_fitness
            best_solution = copy(harmonies[:, current_best_idx])
        end

        if send_func !== nothing
            send_func(iteration, best_fitness, best_solution, collect(eachcol(harmonies)))
        end

        if !target_achieved && best_fitness <= target_fitness
            target_achieved = true
            min_iters = iteration
        end
    end

    if target_fitness > -Inf
        send_func(min_iters, best_fitness, best_solution, collect(eachcol(harmonies)))
    end
    return best_solution, best_fitness
end


end # module HS