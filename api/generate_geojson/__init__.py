import azure.functions as func

def main(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        body='{"status": "generate_geojson endpoint reached"}',
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": "*"}
    )
