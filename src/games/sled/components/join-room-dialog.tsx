import { useState } from "react";
import { DoorOpen, Hash, LoaderCircle, Radio, UserRound } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";

type JoinRoomDialogProps = {
  open: boolean;
  busy: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onJoin: (code: string, name: string) => Promise<void>;
};

export function JoinRoomDialog({ open, busy, error, onOpenChange, onJoin }: JoinRoomDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const valid = code.replace(/\D/g, "").length === 6 && name.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="join-dialog">
        <DialogHeader>
          <div className="join-dialog-mark"><Radio /></div>
          <DialogTitle>ВОЙТИ В ОПЕРАТИВНУЮ ГРУППУ</DialogTitle>
          <DialogDescription>
            Введите код с экрана ведущего. Никакая подписка для подключения не нужна.
          </DialogDescription>
        </DialogHeader>
        <div className="join-fields">
          <label>
            <span><Hash /> КОД КОМНАТЫ</span>
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="room-code-input"
              aria-label="Код комнаты"
            />
          </label>
          <label>
            <span><UserRound /> ВАШЕ ИМЯ</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, 24))}
              autoComplete="nickname"
              placeholder="Например, Даниил"
              aria-label="Имя игрока"
            />
          </label>
        </div>
        {error && <div className="room-api-error"><Radio /> {error}</div>}
        <DialogFooter>
          <Button
            className="primary-action wide"
            disabled={!valid || busy}
            onClick={async () => {
              await onJoin(code, name);
              onOpenChange(false);
            }}
          >
            {busy ? <LoaderCircle className="spin" /> : <DoorOpen />}
            {busy ? "ПОДКЛЮЧАЕМ К КАНАЛУ…" : "ВОЙТИ ПО КОДУ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
