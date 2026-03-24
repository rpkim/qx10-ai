'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
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
import { loadQuestionTemplates, type QuestionTemplate } from '@/lib/question-templates';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (template: QuestionTemplate) => void;
}

export function QuestionTemplatePlaceDialog({ open, onOpenChange, onPick }: Props) {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (!open) return;
    const list = loadQuestionTemplates();
    setTemplates(list);
    setSelectedId((prev) => {
      if (prev && list.some((x) => x.id === prev)) return prev;
      return list[0]?.id ?? '';
    });
  }, [open]);

  const selected = templates.find((x) => x.id === selectedId) ?? null;

  const handleAdd = () => {
    if (!selected) return;
    onPick(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{t('templates.placeDialogTitle')}</DialogTitle>
        </DialogHeader>
        {templates.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('templates.emptyList')}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t('templates.chooseTemplate')}
            </span>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full text-left text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id} className="text-sm">
                    {tpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-muted-foreground font-mono text-xs leading-relaxed">
                {selected.pattern}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleAdd} disabled={!selected}>
            {t('templates.placeOnCanvas')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
