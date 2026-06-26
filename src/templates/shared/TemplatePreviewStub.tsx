import type { TemplateMetadata, TemplatePreviewProps } from './types';

type TemplatePreviewStubProps = TemplatePreviewProps & {
  metadata: TemplateMetadata;
};

export function TemplatePreviewStub({ metadata, viewport = 'mobile' }: TemplatePreviewStubProps) {
  return (
    <section>
      <h2>{metadata.name}</h2>
      <p>
        {metadata.key} v{metadata.version} preview for {viewport}
      </p>
    </section>
  );
}
