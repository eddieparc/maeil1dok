"""OpenAPI post-processing for compatibility aliases."""


HTTP_METHODS = {'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'}
DATABASE_INTEGER_RANGES = {
    (-2147483648, 2147483647),
    (-9223372036854775808, 9223372036854775807),
}


def normalize_database_integer_ranges(result, generator, request, public):
    """Remove model IntegerField limits that vary between SQLite and MySQL."""
    def visit(value):
        if isinstance(value, dict):
            integer_range = (value.get('minimum'), value.get('maximum'))
            if value.get('type') == 'integer' and integer_range in DATABASE_INTEGER_RANGES:
                value.pop('minimum')
                value.pop('maximum')
                if value.get('format') == 'int64':
                    value.pop('format')
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(result)
    return result


def add_router_api_root(result, generator, request, public):
    """Document the DefaultRouter API root that drf-spectacular intentionally skips."""
    result['paths']['/api/v1/todos/'] = {
        'get': {
            'operationId': 'todos_api_root_retrieve',
            'summary': 'List router resource URLs',
            'tags': ['todos'],
            'security': [{}],
            'responses': {
                '200': {
                    'description': 'Named router resources.',
                    'content': {
                        'application/json': {
                            'schema': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string',
                                    'format': 'uri',
                                },
                            },
                        },
                    },
                },
            },
        },
    }
    result['paths'] = dict(sorted(result['paths'].items()))
    return result


def mark_duplicate_account_aliases_deprecated(result, generator, request, public):
    """Deprecate the noncanonical copy of each doubly exposed account route."""
    # 정규 prefix 는 `/api/v1/auth/` 하나다.
    #
    # 근거(실측): 모바일 셸은 `/api/v1/auth/` 만 쓰고 `/api/v1/accounts/` 는 한 번도
    # 쓰지 않는다(20건 vs 0건). 셸을 고치려면 앱 배포가 필요하고 OTA 도달도 확인되지
    # 않았으므로, 셸이 쓰는 쪽을 정규로 삼는 것이 유일하게 안전한 선택이다.
    # 웹의 `/accounts/` 호출은 `/auth/` 로 이관했다.
    #
    # 이전 판은 `profile/`·`follow/` 등 8개 접미사만 `/accounts/` 를 정규로 삼아
    # 방향이 접미사별로 갈렸고, 그 결과 **셸이 의존하는 `/auth/` 쪽이 폐기 예정으로
    # 표시**됐다. 정규를 하나로 통일한다.
    paths = result.get('paths', {})
    for path, path_item in paths.items():
        if not path.startswith('/api/v1/accounts/'):
            continue
        suffix = path.removeprefix('/api/v1/accounts/')
        canonical_path = f'/api/v1/auth/{suffix}'
        if canonical_path not in paths:
            continue

        alias_note = f'Deprecated compatibility alias. Use `{canonical_path}`.'
        for method, operation in path_item.items():
            if method not in HTTP_METHODS:
                continue
            operation['deprecated'] = True
            description = operation.get('description')
            operation['description'] = (
                f'{alias_note}\n\n{description}' if description else alias_note
            )

    return result
