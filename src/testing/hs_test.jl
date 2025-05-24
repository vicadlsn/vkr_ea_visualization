include("./testing.jl")
include("../hs.jl")

function run_tests_for_hs(mode::String = "canonical")
    dim = 2
    population_size = 50  # Harmony Memory Size (HMS)
    max_generations = 500
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
            hmcr = 0.95,
            par = 0.7,
            bw = 0.05,
            mode = mode,
            send_func = (args...) -> nothing
        )

        println("- Среднее: ", round(res.mean, digits=6))
        println("- Std:     ", round(res.std, digits=6))
        println("- Лучшая:  ", round(res.best, digits=6))
        println("- Худшая:  ", round(res.worst, digits=6))
        println()
    end
end

# Вызов тестов
run_tests_for_hs("canonical")
run_tests_for_hs("adaptive") 