module MathParser

using GeneralizedGenerated
const ALLOWED_FUNCTIONS = Set([
    :+, :-, :*, :/, :^,
    :sin, :cos, :tan, :asin, :acos, :atan,
    :sinh, :cosh, :tanh, :asinh, :acosh, :atanh,
    :sqrt, :cbrt, :abs, :exp, :log, :log10, :log2,
    :min, :max, :round, :floor, :ceil,
    :mod, :hypot
])

const ALLOWED_VARIABLES = Set([:x, :y, :pi, :π, :PI, :e, :E])

function validate_expr(expr)
    if expr isa Symbol
        return expr in ALLOWED_VARIABLES
    elseif expr isa Number
        return true
    elseif expr isa Expr
        if expr.head == :call
            f = expr.args[1]
            if f isa Symbol && f in ALLOWED_FUNCTIONS
            #if f in ALLOWED_FUNCTIONS
                return all(validate_expr, expr.args[2:end])
            end
        else
            return false
        end
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

end #End module