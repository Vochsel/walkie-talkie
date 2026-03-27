import { codeToHtml } from 'shiki';

export async function Code({
  code,
  lang = 'typescript',
  title,
}: {
  code: string;
  lang?: string;
  title?: string;
}) {
  const html = await codeToHtml(code.trim(), {
    lang,
    theme: 'github-dark-default',
  });

  return (
    <div className="code-block">
      {title && (
        <div className="code-title">
          <span className="code-dot" />
          <span className="code-dot" />
          <span className="code-dot" />
          <span className="code-title-text">{title}</span>
        </div>
      )}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
