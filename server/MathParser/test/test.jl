using Test
include("../src/math_parser.jl")

@testset "validate_expr" begin
    @test validate_expr(Meta.parse("x + y"))
    @test validate_expr(Meta.parse("sin(x*(mod(x^2, 4))) + cos(y)"))
    @test !validate_expr(Meta.parse("foo(x)"))
    @test !validate_expr(Meta.parse("x + z"))
    @test validate_expr(Meta.parse("pi * x + e"))
    @test !validate_expr(Meta.parse("import os"))
    @test !validate_expr(Meta.parse("x[1]"))
    @test !validate_expr(Meta.parse("x+z"))
    @test !validate_expr(Meta.parse("pow(y, 2)"))


    @test validate_expr(Meta.parse("sin(x)"))         
    @test !validate_expr(Meta.parse("round(x, 2)"))       
    @test validate_expr(Meta.parse("log(2, x)") )        
    @test validate_expr(Meta.parse("min(1, 2, 3, 4)"))   
    @test !validate_expr(Meta.parse("mod(x, y, 3)"))   
    @test validate_expr(Meta.parse("x ^ 2 + y ^ 2"))   
    @test !validate_expr(Meta.parse("sin(x, y)"))      
end

@testset "replace_constants" begin
    expr = Meta.parse("E + PI + x")
    replaced = replace_constants(expr)
    @test occursin("ℯ", string(replaced))
    @test occursin("pi", string(replaced))
    @test occursin("x", string(replaced))
end

@testset "validate_math_expression" begin
    @test validate_math_expression("x^2 + y^2")
    @test !validate_math_expression("x^2 + unknownfunc(y)")
end

@testset "make_function_v2" begin
    f = make_function_v2("x^2 + y^2")
    @test f([1.0, 2.0]) ≈ 5.0
    @test f([0.0, 0.0]) ≈ 0.0
    @test make_function_v2("foo(x)") === nothing

    f_rastrigin = make_function_v2("20 + x^2 + y^2 - 10*(cos(2*pi*x) + cos(2*pi*y))")
    @test f_rastrigin([0.0, 0.0]) ≈ 0.0
    @test isapprox(f_rastrigin([1.0, 1.0]), 2.0; atol=1e-6)

    f_exp_pi = make_function_v2("e^x + pi*y")
    @test isapprox(f_exp_pi([1.0, 2.0]), exp(1.0) + π*2.0; atol=1e-6)
    @test isapprox(f_exp_pi([0.0, 1.0]), 1.0 + π; atol=1e-6)
end