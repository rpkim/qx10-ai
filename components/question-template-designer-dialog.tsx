'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18n } from '@/components/i18n-provider';
import type { QueryToolChoice } from '@/lib/types';
import {
  parseTemplateVariableKeys,
  upsertQuestionTemplate,
} from '@/lib/question-templates';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPattern: string;
  initialName?: string;
  initialToolChoice?: QueryToolChoice;
  initialFollowUpQuestions?: string[];
  /** When set, overwrites this saved template on save */
  templateId?: string | null;
  onSaved?: () => void;
}

export function QuestionTemplateDesignerDialog({
  open,
  onOpenChange,
  initialPattern,
  initialName = '',
  initialToolChoice = 'auto',
  initialFollowUpQuestions = [],
  templateId = null,
  onSaved,
}: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const [pattern, setPattern] = useState(initialPattern);
  const [toolChoice, setToolChoice] = useState<QueryToolChoice>(initialToolChoice);
  const [followUpText, setFollowUpText] = useState('');

  useEffect(() => {
    if (open) {
      setName(initialName);
      setPattern(initialPattern);
      setToolChoice(initialToolChoice);
      setFollowUpText(initialFollowUpQuestions.join('\n'));
    }
  }, [open, initialName, initialPattern, initialToolChoice, initialFollowUpQuestions]);

  const vars = useMemo(() => parseTemplateVariableKeys(pattern), [pattern]);

  const handleSave = () => {
    const followUpQuestions = followUpText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    upsertQuestionTemplate({
      id: templateId ?? undefined,
      name: name || initialName || 'Untitled',
      pattern,
      toolChoice,
      followUpQuestions,
    });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{t('templates.designerTitle')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('templates.designerHint')}
          </DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">{t('templates.designerHint')}</p>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t('templates.nameLabel')}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-input bg-background rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={t('templates.nameLabel')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t('templates.patternLabel')}
          </label>
          <textarea
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            rows={5}
            className="border-input bg-background resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t('templates.designerToolLabel')}
          </label>
          <Select
            value={toolChoice}
            onValueChange={(v) => setToolChoice(v as QueryToolChoice)}
          >
            <SelectTrigger className="w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto" className="text-xs">
                Auto
              </SelectItem>
              <SelectItem value="web" className="text-xs">
                Web Search
              </SelectItem>
              <SelectItem value="market" className="text-xs">
                Stock
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t('templates.followUpsLabel')}
          </label>
          <textarea
            value={followUpText}
            onChange={(e) => setFollowUpText(e.target.value)}
            rows={4}
            placeholder={t('templates.followUpsPlaceholder')}
            className="border-input bg-background resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            {t('templates.followUpsHint')}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t('templates.detectedVars')}
          </span>
          {vars.length === 0 ? (
            <span className="text-muted-foreground text-xs">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {vars.map((v) => (
                <span
                  key={v}
                  className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs"
                >
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!pattern.trim()}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
