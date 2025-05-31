__precompile__()

using GeneralizedGenerated

const ALLOWED_FUNCTIONS = Dict(
    :sqrt   => (1, 1),
    :cbrt   => (1, 1),
    :abs    => (1, 1),
    :exp    => (1, 1),
    :log    => (1, 2),  # log(x) или log(base, x)
    :log10  => (1, 1),
    :log2   => (1, 1),

    :sin    => (1, 1),
    :cos    => (1, 1),
    :tan    => (1, 1),
    :asin   => (1, 1),
    :acos   => (1, 1),
    :atan   => (1, 1),
    :sinh   => (1, 1),
    :cosh   => (1, 1),
    :tanh   => (1, 1),
    :asinh  => (1, 1),
    :acosh  => (1, 1),
    :atanh  => (1, 1),
    
    :round  => (1, 1),
    :floor  => (1, 1),
    :ceil   => (1, 1),
    :hypot  => (1, typemax(Int)),
    :min    => (1, typemax(Int)),
    :max    => (1, typemax(Int)),
    :mod    => (2, 2),
)

const ALLOWED_OPERATORS = Set([:+, :-, :*, :/, :^])

const ALLOWED_VARIABLES = Set([:x, :y, :pi, :π, :PI, :e, :E])

function validate_expr(expr)
    if expr isa Symbol
        return expr in ALLOWED_VARIABLES
    elseif expr isa Number
        return true
    elseif expr isa Expr && expr.head == :call
        f = expr.args[1]
        args = expr.args[2:end]

        if f isa Symbol
            if f in ALLOWED_OPERATORS
                return all(validate_expr, args)
            elseif haskey(ALLOWED_FUNCTIONS, f)
                minargs, maxargs = ALLOWED_FUNCTIONS[f]
                nargs = length(args)
                return (nargs >= minargs && nargs <= maxargs) &&
                       all(validate_expr, args)
            end
        end
        return false
    else
        return false
    end
end
function replace_constants(expr)
    if expr isa Symbol
        if expr == :e || expr == :E
            return :ℯ
        elseif expr == :PI
            return :pi
        else
            return  expr
        end
    elseif expr isa Number
        return expr
    elseif expr isa Expr
        return Expr(expr.head, map(replace_constants, expr.args)...)
    else
        return expr
    end
end

function validate_math_expression(s::String)
    expr = Meta.parse(s)
    return validate_expr(expr)
end

function make_function_v2(f_expr::String)
    f_parsed = Meta.parse(f_expr)
    if !validate_expr(f_parsed)
        return nothing
    end
    f_replaced = replace_constants(f_parsed)
    f = mk_function(:( (x, y) -> $((f_replaced)) ))
    f_wrapped =  v -> f(v[1], v[2])
    return f_wrapped
end