include("./testing.jl")
include("../src/bbo.jl")
using .Testing, ..BBO

function run_tests_for_bbo_2()
    dim = 2
    population_size = 50
    max_generations = 500
    runs = 50

    for (fname, f) in Testing.test_functions
        println("Функция: $fname")
        lb, ub = Testing.bounds_dict[fname]
        res = Testing.test_algorithm(
            BBO.bbo;
            func = f,
            dim = dim,
            lower_bound = lb,
            upper_bound = ub,
            population_size = population_size,
            max_generations = max_generations,
            runs = runs,
            mutation_probability = 0.1,
            blending_rate = 0.2,
            num_elites = 2
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


function run_tests_for_bbo_10()
    dim = 20
    population_size = 50
    max_generations = 5000
    runs = 50

    for (fname, f) in Testing.test_functions
        println("Функция: $fname")
        lb, ub = Testing.bounds_dict[fname]
        res = Testing.test_algorithm(
            BBO.bbo;
            func = f,
            dim = dim,
            lower_bound = lb,
            upper_bound = ub,
            population_size = population_size,
            max_generations = max_generations,
            runs = runs,
            mutation_probability = 0.1,
            blending_rate = 0.1,
            num_elites = 2
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
run_tests_for_bbo_2()