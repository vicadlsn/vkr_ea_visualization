include("./testing.jl")
include("../src/bbo.jl")
using .Testing, ..BBO

function run_tests_for_bbo()
    dim = 2
    population_size = 50
    max_generations = 500
    runs = 30

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
            blending_rate = 0.0,
            num_elites = 2,
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
run_tests_for_bbo()