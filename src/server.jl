using HTTP, Base.Threads
using Logging
using LoggingExtras
using Dates

include("./ws_handler.jl")
include("./router.jl")

const LOCALIP = "127.0.0.1" #string(Sockets.getipaddr())
const HTTP_PORT = 9000

function setup_logger()
    log_dir = "logs"
    try
        isdir(log_dir) || mkdir(log_dir)
    catch e
        @error "Failed to create log directory: $e"
        throw(e)
    end
    #timestamp = Dates.format(now(), "yyyy-mm-dd_HH-MM-SS")
    #log_file = joinpath(log_dir, "server_$timestamp.log")
    log_file = joinpath(log_dir, "server.log")
    logger = FileLogger(
        log_file
    )

    global_logger(TeeLogger(
        ConsoleLogger(stderr, Logging.Info),
        logger
    ))
    @info "Logger initialized" log_file=log_file
end


function main() 
    setup_logger()
    router = Router.create_router()

    # Обработка SIGINT для graceful shutdown
    Base.exit_on_sigint(false)
    server_task = @async try
        HTTP.listen(LOCALIP, HTTP_PORT) do http::HTTP.Stream
            if HTTP.WebSockets.isupgrade(http.message)
                handle_ws_client(http)
            else
                HTTP.streamhandler(router)(http)
            end
        end
    catch e
        @error "Server error: $e"
        rethrow()
    end

    # Ожидание SIGINT и завершение задач
    try
        wait(server_task)
    catch e
        if e isa InterruptException
            @info "Shutting down server"
            lock(lock) do
                for (key, task) in optimizations
                    cancel_flags[key] = true
                    wait(task)
                end
                empty!(optimizations)
                empty!(cancel_flags)
            end
            @info "Server stopped"
        else
            rethrow()
        end
    end
end

main()
