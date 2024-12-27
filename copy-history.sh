#!/bin/bash

API_URL="http://localhost:8080/api/v1/allCommands"

response=$(curl -s -w "%{http_code}" -o response.json "$API_URL")

if [ "$response" -eq 200 ]; then
  echo "API call successful. Processing commands..."

  commands=$(jq -r '.commands[]' response.json)

  history_file="${HOME}/.zsh_history"
  
  for command in $commands; do
    timestamp=$(date +%s)
    formatted_command=": ${timestamp}:0;${command}"
    echo "$formatted_command" >> "$history_file"
    echo "Added command to .zsh_history: $formatted_command"
  done

  echo "Commands successfully added to .zsh_history."
else
  echo "Failed to call the API. Status code: $response"
fi