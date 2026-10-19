import postcss from 'postcss';

/**
 * hover-guard — 터치 기기의 hover 고착(sticky hover) 방지.
 *
 * 모바일 Safari/Chrome은 탭한 요소에 :hover 상태가 남아 버튼이 계속 눌린
 * 것처럼 보인다. hover를 지원하는 포인터가 있을 때만 :hover 규칙이 적용되도록
 * 선택자에 :hover가 포함된 모든 규칙을 @media (hover: hover)로 감싼다.
 * Tailwind의 hover: 유틸리티도 tailwind.config의 hoverOnlyWhenSupported와
 * 함께 이 경로로 커버된다.
 */
const plugin = () => ({
  postcssPlugin: 'hover-guard',
  Rule(rule) {
    if (!rule.selector || !rule.selector.includes(':hover')) return;
    const parent = rule.parent;
    if (parent?.type === 'atrule' && parent.name === 'media' &&
        /hover\s*:\s*hover/.test(parent.params)) return;
    const media = postcss.atRule({ name: 'media', params: '(hover: hover)' });
    rule.replaceWith(media);
    media.append(rule);
  },
});
plugin.postcss = true;

export default plugin;
