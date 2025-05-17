module Mathenize

using GeneralizedGenerated

function parse_function(math::String, print_info::Bool=false)
    r = nothing
    math = Meta.parse(math)
    hasproperty(math, :args) ? tasks = length(math.args) : tasks = 0
    
    #Adding to log info.
    LOG_INFO = []
    push!(LOG_INFO, "-> $(math) <- \n └Tasks: $(tasks)\n └$(hasproperty(math, :args) ? math.args : "Empty")")
    if math !== nothing
    if tasks >= 1
        push!(LOG_INFO, "   └ Performing subtasks:")
        r = subtasking(math, tasks, math.args, LOG_INFO, print_info)
    elseif math isa Number
        push!(LOG_INFO, "   └$(math) is a number")
        r = math
    elseif math in sym
        push!(LOG_INFO, "   └$(math) is a valid symbol")
        r = math
        # r = Core.eval(Base.Math, math)
    elseif tasks == 1 && ispermitted(math, LOG_INFO)
        push!(LOG_INFO, "   └$(math) is a valid a permitted number or expression")
       # r = Core.eval(Base.Math, math)
       r = math
    else
        r = nothing
        unknownmath(math, LOG_INFO, print_info)
    end
    end

    if print_info == true
        @info join(LOG_INFO, "\n")
    end

    return r #Return result

end 

sym = [ :sqrt, :+, :-, :/, :^, :tan, :*,
        :sin, :cos, :sincos, :sind, :cosd, 
        :tand, :sinh, :cosh, :tanh, :log, 
        :pi, :π, :\, :fma, :muladd, :inv, 
        :div, :÷, :fld, :cld, :mod, :eps,
        :rem2pi, :mod2pi, :divrem, :fldmod,
        :fld1, :mod1, ://, :rationalize, 
        :numerator, :denominator, :<<, :>>,
        :>>>, :bitrotate, :cmp, :complex,
        :~, :&, :|, :asin, :acos, :atan,
        :asind, :acosd, :atand, :sec, :csc,
        :cot, :secd, :cscd, :cotd, :asec,
        :acsc, :acot, :asecd, :acscd, :acotd,
        :sech, :csch, :coth, :asinh, :acosh,
        :atanh, :atan, :asech, :acsch, :acoth,
        :sinc, :cosc, :deg2rad, :hypot, :log2, 
        :log10, :log1p, :frexp, :exp, :exp2,
        :exp10, :ldexp, :modf, :expm1, :round,
        :ceil, :floor, :trunc, :unsafe_trunc,
        :min, :max, :minmax, :clamp, :clamp!,
        :abs, :abs2, :copysign, :sign, :signbit,
        :flipsign, :isqrt, :cbrt, :real, :imag, 
        :reim, :conj, :angle, :cis, :cispi,
        :binomial, :factorial, :gcd, :lcm, 
        :gcdx, :ispow2, :nextpow, :prevpow, 
        :nextprod, :invmod, :powermod, :ndigits, 
        :widemul, :evalpoly, :@evalpoly, :im, 
        :vcat, :hcat, :sum]

function subtasking(math, tasks, sbtask, LOG_INFO, print_info)
    success = false
    for ñ in sbtask[1:tasks]

        if hastask(ñ)

            for i in 1:length(ñ.args)

                if ñ.args[i] in sym
                    success = true
                    continue
                elseif ñ.args[i] isa Number
                    success = true
                    continue
                elseif ispermitted(ñ.args[i], LOG_INFO)
                    success = true
                    continue
                else
                    push!(LOG_INFO, "       └ $(ñ) -> $(typeof(ñ)) ||| $(ñ.args[1]) -> $(typeof(ñ)) was not a recognized subtask")
                    unknownmath(ñ, LOG_INFO, print_info)
                end
            end
                
        elseif ispermitted(ñ, LOG_INFO) 
            success = true
        else
            push!(LOG_INFO, "       └ $(ñ) was not a recognized task")
            unknownmath(ñ, LOG_INFO, print_info)
        end
    end

    push!(LOG_INFO, "    Subtasks were all read\n(...) Checking if expression was parsed and can be computed")
    if success
        push!(LOG_INFO, "! Expression was parsed and computed succesfully\n")
        return math
    else
        push!(LOG_INFO, "! Expression was not parsed succesfully\n")
        return nothing
    end
    
end

#Check if value is a valid math operation, such as a mathematical function, number, vector, or matrix.
function ispermitted(tsk, LOG_INFO)
    push!(LOG_INFO, "    └ -> $(tsk) is being checked, its type is: $(typeof(tsk))")

    if tsk in sym
        push!(LOG_INFO, "        └ $(tsk) is permitted that belongs to: $(tsk)")
        return true

    elseif tsk isa Number
        push!(LOG_INFO, "        └ $(tsk) is permitted that belongs to: $(tsk)")
        return true

    elseif tsk isa Symbol
        if tsk in [:x, :y]
            push!(LOG_INFO, "        └ $(tsk) is permitted (variable)")
            return true
        else
            push!(LOG_INFO, "        └ $(tsk) is NOT permitted (symbol in sym but not handled)")
            return false
        end

    elseif tsk isa Expr && hasproperty(tsk, :head)
        if tsk.head == :row
            push!(LOG_INFO, "        └ $(tsk) is a valid row that belongs to: $(tsk)")
            return true
        elseif tsk.head == :hcat || tsk.head == :vcat || tsk.head == :vect
            push!(LOG_INFO, "        └ $(tsk) is a valid matrix or vector that belongs to: $(tsk)")
            return true
        elseif length(tsk.args) > 0 && tsk.args[1] in sym
            push!(LOG_INFO, "        └ $(tsk.args[1]) is a valid expression found in sym that belongs to: $(tsk)")
            return true
        else
            push!(LOG_INFO, "       └ $(tsk) was not recognized as permitted Expr")
            return false
        end

    else
        push!(LOG_INFO, "       └ $(tsk) was not recognized as permitted")
        return false
    end
end

#Check if argument contains subarguments.
function hastask(sb)
    return hasproperty(sb, :args) ? true : false
end

#Error when given input contains an unknown operation.
function unknownmath(ñ, LOG_INFO, print_info::Bool)

    items = "and is an empty value."
    if !print_info 
        message_info = "Check the log using calculate(math::String, true)"
    else
        message_info = ""
        @info join(LOG_INFO, "\n")
    end
    if hastask(ñ) items = "that contains $(ñ.args)" end
    error("Error in Mathenize syntax. $(message_info)\n└ ->$(ñ) is not recognized as a valid math operation. \n └ The input given is a $(typeof(ñ)) $(items)")
    return nothing

end

const mathjs_to_julia = Dict(
    "pow" => :^,
    "mod" => :mod,
    "rem" => :rem2pi,
    "sin" => :sin,
    "cos" => :cos,
    "tan" => :tan,
    "sqrt" => :sqrt,
)

function preprocess_mathjs(expr::String)
    for (k,v) in mathjs_to_julia
        expr = replace(expr, k => string(v))
    end
    return expr
end

function function_from_mathjs(expr_str::String; print_info::Bool=false)
    expr_str = preprocess_mathjs(expr_str)
    return calculate(expr_str, print_info)
end


f = "x + y * 2"
f_e = calculate_mathjs(f)
if isnothing(f_e)
    print("f is nothing")
else
    f = mk_function(:( (x, y) -> $((f_e)) ))
    f_wrapped =  v -> f(v[1], v[2])
    print(f_wrapped([1, 2]))
end
end #End module