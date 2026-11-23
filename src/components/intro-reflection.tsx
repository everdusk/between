"use client";

import examples from "@/lib/onboarding-examples.json";
import Image from "next/image";
import { Check } from "lucide-react";
import { messengerChoices, type MessengerChoice } from "@/lib/intro-messengers";
import { useEffect, useState } from "react";
import { useI18n } from "./locale-provider";
import { useDemoMediaDirectory } from "./scheme-switch";
import { Button } from "./ui/button";
import { IntroStepHeader } from "./intro-step-header";
import { GlassPanel } from "./ui/glass-panel";
import { Textarea } from "./ui/textarea";
import { PICKER_FEELINGS, type Feeling, type JournalEntry } from "@/lib/types";
import { WeekSpectrum } from "./week-spectrum";
import { checkinEntry, checkinQuestion, type IntroCheckin } from "@/lib/intro-checkin";
import { Badge } from "./ui/badge";
import { FeelingStripe } from "./feeling-stripe";
import { formatTime } from "@/lib/dates";
import { markMoment, type IntroMood, type IntroDraft } from "@/lib/intro-record";
import { feelingFill } from "@/lib/spectrum";
import { trackSurvey } from "@/lib/survey-analytics";

export const introDraftKey = "between:intro:registration:v2";

const steps = ["recent", "spectrum", "recent_reason", "current", "therapy", "topics_demo", "messengers", "bot_demo", "observation"] as const;
export const introStepCount = steps.length + 1; // Registration follows the entry preview.

const sampleDays = Array.from({length: 7}, (_, i) => "2026-11-" + String(9+i).padStart(2,"0"));
const sampleFeelings: [time: string, mood: Feeling][][] = [
  [["09:10", "спокойно"], ["19:40", "тревожно"]],
  [["08:20", "спокойно"], ["12:15", "радость"], ["16:30", "спокойно"], ["20:10", "тревожно"]],
  [["14:25", "радость"]],
  [["10:00", "спокойно"], ["15:35", "усталость"], ["19:15", "тревожно"]],
  [],
  [["11:45", "радость"], ["17:05", "спокойно"]],
  [["13:30", "спокойно"]],
];
const sampleEntries: JournalEntry[] = sampleFeelings.flatMap((day, index) => day.map(([time, mood]) => {
  const date = sampleDays[index];
  const timestamp = date + "T" + time + ":00Z";
  return {id: timestamp, date, createdAt: timestamp, updatedAt: timestamp, feelings: [mood],
    body: "", tags: [], source: "app"};
}));

export function IntroCard({record}: {record:IntroDraft}) {
  const {locale, feeling} = useI18n();
  if (record.kind === "checkin") {
    const entry = checkinEntry(record);
    const mood = entry.feelings[0];
    return <GlassPanel className="relative overflow-hidden px-6 py-5">
      {mood && <FeelingStripe feeling={mood} className="inset-y-5" />}
      <time dateTime={entry.createdAt} className="tabular text-xs font-medium">{formatTime(entry.createdAt, locale)}</time>
      {mood && <div className="mt-3"><Badge variant="secondary" className="font-normal">
        <span aria-hidden className="size-1.5 rounded-full" style={{background: feelingFill(mood)}}/>{feeling(mood)}
      </Badge></div>}
      <p className="mt-3 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-foreground/90">{entry.body}</p>
    </GlassPanel>;
  }
  return <GlassPanel className="space-y-3 p-5">
    <small>{locale==="en" ? "Your first observation" : "Ваше первое наблюдение"}</small>
    <p>{record.observation}</p>
    <p className="font-normal leading-relaxed">{record.prompt}</p>
    {record.note && <blockquote className="diary-quote whitespace-pre-wrap break-words">{record.note.body}</blockquote>}
  </GlassPanel>;
}

export function IntroReflection({onFinish}:{onFinish:(r:IntroDraft)=>boolean}) {
  const {locale,feeling} = useI18n();
  const directory = useDemoMediaDirectory();
  const en = locale==="en";
  const language = en ? "en" : "ru";
  const say=(ru:string,eng:string)=>en?eng:ru;
  const [attempt]=useState(()=>crypto.randomUUID());
  const [step,setStep]=useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [therapy,setTherapy]=useState<IntroCheckin["therapy"]>("no");
  const [recent,setRecent]=useState<IntroMood>("unknown");
  const [recentReason, setRecentReason] = useState("");
  const [current,setCurrent]=useState<IntroMood>("unknown");
  const [moment,setMoment]=useState(markMoment);
  const [changing, setChanging] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<IntroMood | null>(null);
  const [currentReason, setCurrentReason] = useState("");
  const [draftError,setDraftError]=useState(false);
  const [nextSequence] = useState(() => {
    let sequence = 0;
    return () => ++sequence;
  });
  const [messengers, setMessengers] = useState<MessengerChoice[]>([]);
  const demo = messengers.includes("telegram") ? "telegram" : messengers.includes("max") ? "max" : null;
  const example = examples[recent];
  const index = en ? 1 : 0;
  const screen=steps[step];
  function toggleMessenger(choice: MessengerChoice) {
    setMessengers(current => {
      if (current.includes(choice)) return current.filter(m => m !== choice);
      if (choice === "none") return ["none"];
      return [...current.filter(m => m !== "none"), choice];
    });
  }
  useEffect(()=>{
    trackSurvey({event:"web_survey_step",action:"view",question:"v3_"+screen,attempt,sequence:nextSequence()},locale);
  },[screen,attempt,locale,nextSequence]);
  function go(n:number) {
    trackSurvey({event:"web_survey_step",action:n<step?"back":"advance",question:"v3_"+screen,attempt,sequence:nextSequence(),
      ...(screen==="messengers" && n>step ? {messengers} : {})},locale);
    setDirection(n < step ? "back" : "forward");
    setStep(n);
  }
  const label=(m:IntroMood)=>m==="unknown"?say("Пока трудно назвать","Hard to name"):feeling(m);
  const record: IntroCheckin = {kind: "checkin", attempt, language, therapy, messengers, recent, current,
    recentReason: recentReason.trim(), ...(current !== recent ? {currentReason: currentReason.trim()} : {}), ...moment};
  function confirmCurrent(mood: IntroMood) {
    setCurrent(mood);
    setMoment(markMoment());
    go(step+1);
  }
  const topicsScreenshot = directory && `${directory}/onboarding/${example.slug}-${therapy === "yes" ? "therapy" : "personal"}-${language}.webp`;
  const question = screen === "therapy" ? say("Вы сейчас занимаетесь с психотерапевтом?","Are you seeing a therapist?")
    : screen === "topics_demo" ? (therapy === "yes" ? say("Что взять на следующий сеанс?","What would you like to bring to therapy?") : say("К какой мысли вы возвращаетесь?","What keeps coming up for you?"))
    : screen === "messengers" ? say("Какими мессенджерами вы пользуетесь?","Which messaging apps do you use?")
    : screen === "bot_demo" ? say("Дневник прямо в чате","Your journal, right in the chat")
    : screen === "recent" ? say("Какое чувство вы чаще замечаете в последнее время?","Which feeling have you noticed most lately?")
    : screen === "recent_reason" ? say("Поделитесь? Это анонимно", "Would you share? It’s anonymous")
    : screen === "current" ? say("Что вы чувствуете прямо сейчас?", "How do you feel right now?")
    : screen === "spectrum" ? say("Почему важно наблюдать за чувствами?", "Why pay attention to your feelings?")
    : say("Ваша первая запись", "Your first entry");
  function option(text:string,click:()=>void) {
    return <Button key={text} type="button" variant="outline" className="h-auto min-h-10 max-w-full whitespace-normal text-start" onClick={click}>{text}</Button>;
  }
  const showMascot = screen === "bot_demo" || screen === "spectrum" || screen === "observation"
    || (screen === "topics_demo" && therapy === "yes");
  return <GlassPanel className="space-y-5 p-6" data-intro-mascot={showMascot ? screen : undefined}>
    <IntroStepHeader backLabel={say("Назад", "Back")} onBack={step > 0 ? () => go(step - 1) : undefined}>
      Between · {say("Знакомство","Getting to know you")} · {step+1}/{introStepCount}
    </IntroStepHeader>
    <div key={screen} className="intro-screen space-y-5" data-direction={direction}>
    <h1 className="font-display text-2xl">{question}</h1>
    {screen==="therapy" && <div className="flex flex-wrap gap-2">{option(say("Да","Yes"),()=>{setTherapy("yes");go(step+1)})}{option(say("Нет","No"),()=>{setTherapy("no");go(step+1)})}</div>}
    {screen==="topics_demo" && <>
      <p>{therapy === "yes"
        ? say("Between поможет собрать похожие моменты в одну тему. Перед сеансом её можно открыть и выбрать, о чём хочется поговорить.", "Between helps bring related moments into one topic. Before a session, open it and choose what you want to talk about.")
        : say("Between поможет заметить, к чему вы возвращаетесь. В разделе «На подумать» можно открыть тему и увидеть рядом записи за разные дни.", "Between helps you notice what keeps coming up. Open a topic in For reflection to see entries from different days together.")}</p>
      {topicsScreenshot && <Image src={topicsScreenshot} width={582} height={455} unoptimized
        className="block h-auto w-full rounded-2xl"
        alt={[example.title[index], example.first[index], example.second[index]].join(". ")} />}
      <Button className="ms-auto flex w-fit" data-confirm="" onClick={()=>go(step+1)}>{say("Продолжить","Continue")}</Button>
    </>}
    {screen==="messengers" && <>
      <p className="text-sm text-muted-foreground">{say("Можно выбрать несколько.","Choose all that apply.")}</p>
      <div className="flex flex-wrap gap-2">{messengerChoices.map(m => <Button key={m} type="button"
        variant="outline" aria-pressed={messengers.includes(m)}
        className={`gap-2 aria-pressed:border-current ${m === "telegram" || m === "max" ? "auth-" + m : ""}`}
        onClick={()=>toggleMessenger(m)}>
        <span aria-hidden className="grid size-4 place-items-center rounded-full border border-current/40">
          {messengers.includes(m) && <Check className="size-3" strokeWidth={3}/>}
        </span>
        {{telegram:"Telegram",max:"MAX",whatsapp:"WhatsApp",none:say("Не пользуюсь","None")}[m]}</Button>)}</div>
      <Button className="ms-auto flex w-fit" data-confirm="" disabled={!messengers.length} onClick={()=>go(step+1)}>{say("Дальше","Continue")}</Button>
    </>}
    {screen==="bot_demo" && <>
      <p>{demo ? say("В чате с ботом можно оставить заметку, пока момент свеж в памяти. Она появится в вашем дневнике.", "Send the bot a note while the moment is fresh. It will appear in your journal.") : say("Дневник можно вести на сайте. Если когда-нибудь захочется писать из чата, вот как это выглядит в Telegram.", "You can keep your journal on the website. If you ever want to write from chat, here’s how it looks in Telegram.")}</p>
      {directory && <Image unoptimized src={`${directory}/onboarding/${example.slug}-${demo ?? "telegram"}-${language}.webp`}
        width={400} height={408} className="w-full max-w-sm rounded-2xl"
        alt={(demo === "max" ? "MAX" : "Telegram") + " · " + example.chat[index]}/>}
      <Button className="ms-auto flex w-fit" data-confirm="" onClick={()=>go(step+1)}>{say("Продолжить","Continue")}</Button>
    </>}
    {screen==="recent" && <div className="flex flex-wrap gap-2">
      {([...PICKER_FEELINGS,"unknown"] as const).map(m=>option(m==="unknown"?say("Не помню","I don’t remember"):label(m),()=>{
        if (m !== recent) { setRecentReason(""); setChanging(null); setSelected(null); setCurrentReason(""); }
        setRecent(m); go(step+1);
      }))}
    </div>}
    {screen==="recent_reason" && <form className="space-y-3" onSubmit={event=>{event.preventDefault();if(recentReason.trim())go(step+1)}}>
      <label htmlFor="recent-reason" className="block">{checkinQuestion(recent, "recentQuestion", language)}</label>
      <Textarea id="recent-reason" value={recentReason} maxLength={1000} required
        onChange={event=>setRecentReason(event.target.value)} placeholder={say("Можно одной фразой","A few words are enough")}/>
      <Button type="submit" disabled={!recentReason.trim()} className="ms-auto flex w-fit">{say("Продолжить","Continue")}</Button>
    </form>}
    {screen==="current" && <>
      <p>{say("Ваше состояние сейчас отличается от того, что вы описали?", "Does it feel different from what you just described?")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" aria-pressed={changing === true} onClick={()=>setChanging(true)}>
          {changing === true && <Check aria-hidden className="size-4"/>}{say("Да","Yes")}
        </Button>
        <Button variant="outline" aria-pressed={changing === false}
          onClick={()=>{setChanging(false);setSelected(null);setCurrentReason("");confirmCurrent(recent)}}>
          {changing === false && <Check aria-hidden className="size-4"/>}{say("Нет, то же самое","No, it feels the same")}
        </Button>
      </div>
      {changing && <div className="space-y-3">
        <p>{say("Какое чувство вы замечаете сейчас?", "Which feeling do you notice now?")}</p>
        <div className="flex flex-wrap gap-2">{([...PICKER_FEELINGS,"unknown"] as const).filter(m=>m!==recent).map(m=>
          <Button key={m} variant="outline" aria-pressed={selected===m} onClick={()=>{if(selected!==m)setCurrentReason("");setSelected(m)}}>
            {selected===m && <Check aria-hidden className="size-4"/>}{label(m)}
          </Button>)}</div>
        {selected && <form className="space-y-3" onSubmit={event=>{event.preventDefault();if(currentReason.trim())confirmCurrent(selected)}}>
          <label htmlFor="current-reason" className="block">{checkinQuestion(selected,"currentQuestion",language)}</label>
          <Textarea id="current-reason" required maxLength={1000} value={currentReason} onChange={event=>setCurrentReason(event.target.value)}/>
          <Button type="submit" className="ms-auto flex w-fit" disabled={!currentReason.trim()}>{say("Продолжить","Continue")}</Button>
        </form>}
      </div>}
    </>}
    {screen==="spectrum" && <>
      <p>{say("Каждая отметка добавляет цвет в спектр недели. По нему видно, какие чувства возвращаются и в какие дни настроение меняется.",
        "Each check-in adds a colour to your week. Look back to see which feelings recur and which days bring a change.")}</p>
      <figure className="space-y-2">
        <WeekSpectrum dayKeys={sampleDays} entries={sampleEntries} todayKey={sampleDays[6]}
          patternTitle="" patternText="" patternPending="" />
        <p className="text-sm text-muted-foreground">{say("Отмечайте чувства сколько хочется раз в день. Дни можно пропускать.","Check in as often as you like. It’s fine to skip days.")}</p>
      </figure>
      <Button className="ms-auto flex w-fit" data-confirm="" onClick={()=>go(step+1)}>{say("Продолжить","Continue")}</Button>
    </>}
    {screen==="observation" && <>
      <IntroCard record={record}/>
      <Button className="ms-auto flex w-fit" data-confirm="" onClick={()=>{
        if (!onFinish(record)) { setDraftError(true); return; }
        trackSurvey({event:"web_survey_step",action:"finish",question:"v3_observation",attempt,sequence:nextSequence()},locale);
      }}>{say("Записать","Save entry")}</Button>
      {draftError && <p role="alert">{say("Не удалось сохранить черновик. Разрешите хранение данных и попробуйте ещё раз.","We couldn’t save the draft. Allow browser storage and try again.")}</p>}
    </>}
    </div>
  </GlassPanel>;
}
