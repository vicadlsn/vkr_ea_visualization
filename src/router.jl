module Router 

using HTTP
using WebSockets

export create_router 

function index_handler(req::HTTP.Request)
    filepath = "web/templates/index.html"
    html = read(filepath)
    if isfile(filepath)
        return HTTP.Response(200, ["Content-Type" => "text/html"], html)
    else
        return HTTP.Response(404, ["Content-Type" => "text/plain"], "File not found", )
    end
end

function static_handler(req::HTTP.Request)
    path = String(req.target)
    filepath = "web" * path
    if isfile(filepath)
        content = read(filepath)
        mime = get_mime(filepath)
        return HTTP.Response(200, ["Content-Type" => mime], content)
    else
        return HTTP.Response(404, "File not found")
    end
end

function get_mime(filepath::String)
    if endswith(filepath, ".js")
        return "application/javascript"
    elseif endswith(filepath, ".css")
        return "text/css"
    elseif endswith(filepath, ".html")
        return "text/html"
    elseif endswith(filepath, ".png")
        return "image/png"
    else
        return "application/octet-stream"
    end
end

function create_router() 
    router = HTTP.Router()
    
    HTTP.register!(router, "GET", "/", index_handler)
    HTTP.register!(router, "GET", "/static/**", static_handler)

    return router
end

end