module App

using HTTP, Base.Threads
using Logging
using LoggingExtras

using OptimizationHandler

include("router.jl")
using .Router

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
    router = create_router()

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

    wait(server_task)
end

main()



end