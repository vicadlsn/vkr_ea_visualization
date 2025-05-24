include("./testing.jl")
include("../src/ca.jl")
using .Testing, ..CA

function run_tests_for_ca()
    dim = 2
    population_size = 500
    max_generations = 1500
    runs = 30

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
            num_elites = 2,
            num_accepted = 40,
            sigma = 1.0,
            send_func = (args...) -> nothing
        )
        println("- Среднее: ", round(res.mean, digits=6))
        println("- Std:     ", round(res.std, digits=6))
        println("- Лучшая:  ", round(res.best, digits=6))
        println("- Худшая:  ", round(res.worst, digits=6))
        println("- Среднее время:  ", round(res.mean_time, digits=6))
        println("- Std время:  ", round(res.std_time, digits=6))
        println()
    end
end

# Вызов тестов
run_tests_for_ca()