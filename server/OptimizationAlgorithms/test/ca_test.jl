include("./testing.jl")
include("../src/ca.jl")
using .Testing, ..CA

# p200 - e40 - i0.5 - g0.1
# p200 - e40 - i0.1 - g0.001
# 50 5 - 0.1 - 0.1

# 1. p200 - e40 - i0.1 - g0.001
# 2. Экли сходится - p200 e40 intertia=0.5, gamma=0.001 / чуть хежу - 50 5 0.1 0.001
# 3. Гриванк - увеличение дисперсии, i=0.1, gamma=10
function run_tests_for_ca_2(;inertia=0.1, gamma=0.1, beta=0,target_threshold=1e-3)
    dim = 2
    population_size = 200
    max_generations = 500
    runs = 50

    for (fname, f) in Testing.test_functions
        println("Функция: $fname")
        lb, ub = Testing.bounds_dict[fname]
        res = Testing.test_algorithm(
            CA.cultural_algorithm;
            func = f,
            dim = dim,
            lower_bound = lb,
            upper_bound = ub,
            population_size = population_size,
            max_generations = max_generations,
            runs = runs,
           num_accepted = 40,
           inertia=inertia,
           gamma=gamma,
           beta=beta,
           target_threshold=target_threshold,
           #in_bounds=true
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
println("===CA===, DIM=20")
print("===CAEP===")
run_tests_for_ca_2()
print("===EP===")
run_tests_for_ca_2(inertia=1.0,beta=0)