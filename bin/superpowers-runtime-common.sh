normalize_repo_relative_path() {
  local input="${1:-}" part normalized=""
  case "$input" in
    ''|/*) return 1 ;;
  esac
  input="${input//\\//}"
  while IFS= read -r part; do
    case "$part" in
      ''|'.') continue ;;
      '..') return 1 ;;
      *) normalized="${normalized:+$normalized/}$part" ;;
    esac
  done < <(printf '%s\n' "$input" | tr '/' '\n')
  [ -n "$normalized" ] || return 1
  printf '%s\n' "$normalized"
}

normalize_whitespace() {
  printf '%s' "${1:-}" | tr '\r\n\t' '   ' | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//'
}

normalize_whitespace_bounded() {
  local normalized
  local max_len="${2:-}"

  normalized="$(normalize_whitespace "${1:-}")"
  [ -n "$normalized" ] || return 1

  if [[ -n "$max_len" ]] && (( ${#normalized} > max_len )); then
    return 2
  fi

  printf '%s\n' "$normalized"
}

normalize_identifier_token() {
  printf '%s\n' "${1:-}" | sed 's/[^[:alnum:]._-]/-/g'
}
