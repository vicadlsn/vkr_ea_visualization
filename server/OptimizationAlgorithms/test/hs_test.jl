include("./testing.jl")
include("../src/hs.jl")
using .Testing, ..HS

function run_tests_for_hs_2(mode::String = "canonical")
    dim = 2
    population_size = 50
    max_generations = 20000
    runs = 50

    println("=== Harmony Search — режим: $mode ===")
    for (fname, f) in Testing.test_functions
        println("Функция: $fname")
        lb, ub = Testing.bounds_dict[fname]

        res = Testing.test_algorithm(
            HS.harmony_search;
            func = f,
            dim = dim,
            lower_bound = lb,
            upper_bound = ub,
            population_size = population_size,
            max_generations = max_generations,
            runs = runs,
            hmcr = 0.5,
            par = 0.3,
            bw = 0.05,
            par_min=0.05,
            par_max=0.9,
            bw_max=0.05,
            bw_min=0.0001,
            mode = mode,
            target_threshold=1e-3
        )

        println("- Среднее: ", round(res.mean_fitness, digits=6))
        println("- Std:     ", round(res.std_fitness, digits=6))
        println("- Лучшая:  ", round(res.best_fitness, digits=6))
        println("- Худшая:  ", round(res.worst_fitness, digits=6))
        println("- Среднее время:  ", round(res.mean_time, digits=6))
        println("- Std время:  ", round(res.std_time, digits=6))
        println("- Итераций:  ", max_generations)
        println("- Среднее число итераций:  ", ceil(res.mean_iterations))
        println("- Сколько раз сошлось:  ", res.success_count)
        println("- Доля успехов:  ", res.success_rate)
        println("- Среднее расстояние до целевого значения:  ", res.mean_distance_to_target)
        println("- Std  расстояние до целевого значения:  ", res.std_distance_to_target)
        println("- Среднее расстояние до Решения:  ", res.mean_distance_to_solution)
        println("- Std расстояние до решения:  ", res.std_distance_to_solution)
        println()

    end
end

# Вызов тестов
#run_tests_for_hs_2("canonical")
#run_tests_for_hs_2("adaptive") 


println("===HS===, DIM=20")
run_tests_for_hs_2("canonical")
run_tests_for_hs_2("adaptive") 