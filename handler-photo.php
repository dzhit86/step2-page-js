<?php

$response["success"] = "true";

header("Content-type: application/json; charset=utf-8");
echo json_encode($response);
exit();