import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function LegalPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: page, isLoading } = useQuery({
    queryKey: ['legal-page', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legal_pages')
        .select('*')
        .eq('slug', slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const renderMarkdown = (md: string) => {
    return md.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} className="h-3" />;
      if (trimmed.startsWith('### '))
        return <h3 key={i} className="text-sm font-semibold text-foreground mt-5 mb-1.5">{trimmed.slice(4)}</h3>;
      if (trimmed.startsWith('## '))
        return <h2 key={i} className="text-base font-semibold text-foreground mt-6 mb-2">{trimmed.slice(3)}</h2>;
      if (trimmed.startsWith('# '))
        return <h1 key={i} className="text-lg font-bold text-foreground mt-7 mb-3">{trimmed.slice(2)}</h1>;
      if (trimmed.startsWith('- ') || trimmed.startsWith('• '))
        return <li key={i} className="text-xs text-muted-foreground ml-4 list-disc leading-relaxed">{renderInline(trimmed.slice(2))}</li>;
      return <p key={i} className="text-xs text-muted-foreground leading-[1.7]">{renderInline(trimmed)}</p>;
    });
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      return <span key={i}>{part}</span>;
    });
  };

  const formattedDate = page?.updated_at
    ? format(parseISO(page.updated_at), 'MMMM d, yyyy')
    : null;

  return (
    <div className="fixed inset-0 bg-card z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="px-5 py-4 border-b border-border flex items-center">
        <button onClick={() => navigate('/?settings=open', { replace: true })} className="mr-3 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">{page?.title ?? 'Loading…'}</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : page ? (
          <>
            {/* Version & date meta */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>Version {page.version}</span>
              <span>·</span>
              {formattedDate && <span>Last Updated: {formattedDate}</span>}
            </div>

            {/* Plain Language Summary */}
            {page.summary && (
              <div className="bg-secondary rounded-xl p-4">
                <h3 className="text-xs font-semibold text-foreground mb-2">Plain Language Summary</h3>
                <p className="text-xs text-secondary-foreground leading-[1.7]">{page.summary}</p>
              </div>
            )}

            {/* Full content */}
            <div>{renderMarkdown(page.content)}</div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Page not found.</p>
        )}
      </div>
    </div>
  );
}
