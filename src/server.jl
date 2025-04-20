using HTTP, Base.Threads


include("./ws_handler.jl")
include("./router.jl")

router = Router.create_router()

server = HTTP.listen(LOCALIP, HTTP_PORT) do http::HTTP.Stream
    optimizations = Dict{String, Task}()
    cancel_flags = Dict{String, Bool}()
    lock = ReentrantLock()

    if HTTP.WebSockets.isupgrade(http.message)
       handle_ws_client(http, optimizations, cancel_flags, lock)
    else
        HTTP.streamhandler(router)(http)
    end
end
