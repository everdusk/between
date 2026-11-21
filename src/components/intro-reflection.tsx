"use client";

import { useEffect, useState } from "react";
import { useI18n } from "./locale-provider";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { PICKER_FEELINGS, type Feeling, type JournalEntry } from "@/lib/types";
import { WeekSpectrum } from "./week-spectrum";
import { scenes } from "@/lib/intro-scenes";
import { markMoment, type IntroMood, type IntroDraft, type IntroRecord } from "@/lib/intro-record";
import { feelingFill } from "@/lib/spectrum";
import { trackSurvey } from "@/lib/survey-analytics";

export const introDraftKey = "between:intro:registration:v2";

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
  const {locale} = useI18n();
  return <section className="glass space-y-3 rounded-3xl p-5">
    <small>{locale==="en" ? "Your first observation" : "Ваше первое наблюдение"}</small>
    <p>{record.observation}</p>
    <p className="font-normal leading-relaxed">{record.prompt}</p>
    {record.note && <blockquote className="whitespace-pre-wrap break-words border-s-2 border-primary/60 ps-3">{record.note.body}</blockquote>}
  </section>;
}

const steps = ["gender","name","therapy","recent","current","spectrum","situation","clarification","observation"] as const;
export function IntroReflection({onFinish}:{onFinish:(r:IntroDraft)=>boolean}) {
  const {locale,feeling} = useI18n();
  const en = locale==="en", lang=en?1:0;
  const say=(ru:string,eng:string)=>en?eng:ru;
  const [attempt]=useState(()=>crypto.randomUUID());
  const [step,setStep]=useState(0);
  const [gender,setGender]=useState<IntroRecord["gender"]>("neutral");
  const [name,setName]=useState("");
  const [therapy,setTherapy]=useState<IntroRecord["therapy"]>("no");
  const [recent,setRecent]=useState<IntroMood>("unknown");
  const [current,setCurrent]=useState<IntroMood>("unknown");
  const [moment,setMoment]=useState(markMoment);
  const [recalled,setRecalled]=useState(false);
  const [index,setIndex]=useState(0);
  const [answer,setAnswer]=useState("");
  const [note,setNote]=useState("");
  const [draftError,setDraftError]=useState(false);
  const [nextSequence] = useState(() => {
    let sequence = 0;
    return () => ++sequence;
  });
  const screen=steps[step];
  useEffect(()=>{
    trackSurvey({event:"web_survey_step",action:"view",question:"v2_"+screen,attempt,sequence:nextSequence()},locale);
  },[screen,attempt,locale,nextSequence]);
  function go(n:number) {
    trackSurvey({event:"web_survey_step",action:n<step?"back":"advance",question:"v2_"+screen,attempt,sequence:nextSequence()},locale);
    setStep(n);
  }
  const focus=current==="unknown" && recalled?recent:current;
  const scene=scenes[focus];
  const item=scene.choices[index];
  const choice=item ? situation(index) : say("По-другому","Something else");
  const clarification=item?.clarify[lang] ?? say("Какая деталь лучше всего передаёт ваш опыт?","Which detail best captures what it was like for you?");
  const prompt=item?.prompt[lang] ?? say("Что об этом вам хочется запомнить?","What about this would you like to remember?");
  const label=(m:IntroMood)=>m==="unknown"?say("Пока трудно назвать","Hard to name"):feeling(m);
  const context=current==="unknown"
    ? recalled?say("Вы вспомнили недавний момент","You recalled a recent moment") : say("Вы начали с детали дня","You started with a detail from your day")
    : recent!=="unknown" && recent!==current
      ? say("В последнее время — "+label(recent)+". Сейчас — "+label(current),"Lately: "+label(recent)+". Right now: "+label(current))
      : say("Ваша отметка сейчас — "+label(current),"Your check-in right now: "+label(current));
  const record:IntroRecord={attempt,language:en?"en":"ru",name:name.trim(),gender,therapy,recent,current,...moment,recalled,situation:choice,clarification,answer:answer.trim(),prompt,
    observation:context+say(". Когда вы выбрали «",". When you chose “")+choice+say("», вы описали это так: «","”, you described it this way: “")+answer.trim()+say("».","”.")};
  const question=[say("Вы мужчина или женщина?","How do you describe yourself?"),say("Как к вам обращаться?","What should we call you?"),
    say("Вы сейчас занимаетесь с психотерапевтом?","Are you seeing a therapist?"),say("Какое чувство вы чаще замечаете в последнее время?","Which feeling have you noticed most lately?"),
    say("Что вы чувствуете прямо сейчас?","What are you feeling right now?"),current==="unknown"?say("Так выглядит спектр дневника","A look at your mood spectrum"):say("Ваша первая отметка","Your first check-in"),
    scene.title[lang],clarification,say("Ваше первое наблюдение","Your first observation")][step];
  function option(text:string,click:()=>void) {
    return <Button key={text} type="button" variant="outline" className="h-auto min-h-10 max-w-full whitespace-normal text-start" onClick={click}>{text}</Button>;
  }
  function situation(i:number){
    if(!en && focus==="грусть" && i===1) return gender==="male"?"Хочу побыть один":gender==="female"?"Хочу побыть одна":"Хочу побыть наедине с собой";
    return scene.choices[i].option[lang];
  }
  return <section className="glass space-y-5 rounded-3xl p-6">
    <small>Between · {say("Знакомство","Getting to know you")} · {step+1}/{steps.length}</small>
    <h1 className="font-display text-2xl">{question}</h1>
    {step===0 && <div className="flex flex-wrap gap-2">{(["male","female","neutral"] as const).map((g,i)=>option([say("Мужчина","Man"),say("Женщина","Woman"),say("Предпочитаю не указывать","Prefer not to say")][i],()=>{setGender(g);go(1)}))}</div>}
    {step===1 && <form className="space-y-3" onSubmit={e=>{e.preventDefault();if(name.trim())go(2)}}><Input aria-label={question} autoComplete="given-name" maxLength={60} value={name} onChange={e=>setName(e.target.value)}/><Button type="submit" disabled={!name.trim()}>{say("Дальше","Continue")}</Button></form>}
    {step===2 && <div className="flex flex-wrap gap-2">{(["regular","starting","paused","no"] as const).map((v,i)=>option([say("Да, регулярно","Yes, regularly"),say("Только начинаю","Just starting"),say("Сейчас на паузе","Taking a break"),say("Нет","No")][i],()=>{setTherapy(v);go(3)}))}</div>}
    {(step===3 || step===4) && <>
      {step===4 && <p>{say("В последнее время","Lately")} · {label(recent)}</p>}
      <div className="flex flex-wrap gap-2">{([...PICKER_FEELINGS,"unknown"] as const).map(m=>option(m==="unknown" && step===3?say("Не помню","I don’t remember"):label(m),()=>{
        if(step===3)setRecent(m);else {setCurrent(m);setMoment(markMoment());setRecalled(false)}
        setAnswer("");setIndex(0);go(step+1);
      }))}</div></>}
    {step===5 && <><p className="flex items-center gap-2"><span className="size-3 rounded-full" style={{background:feelingFill(current==="unknown"?"спокойно":current)}}/>
      {current==="unknown"?say("Пример отметки","Example check-in"):new Date(moment.markedAt).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"})} · {label(current==="unknown"?"спокойно":current)}</p>
      <p>{say("В какие моменты тревожно, даже если день прошёл спокойно? Сверяясь с записями, можно заметить, например, что в три таких вечера вы ждали ответа на важное сообщение.","When do you feel anxious, even after a quiet day? Looking back at your entries, you might notice that on three of those evenings you were waiting for a reply to an important message.")}</p>
      <figure className="space-y-2">
        <figcaption className="text-sm text-muted-foreground">{say("Пример из дневника · 9–15 ноября","Example journal · November 9–15")}</figcaption>
        <WeekSpectrum dayKeys={sampleDays} entries={sampleEntries} todayKey={sampleDays[6]}
          patternTitle="" patternText="" patternPending="" />
        <p className="text-sm text-muted-foreground">{say("Отмечайте чувства сколько хочется раз в день. Дни можно пропускать.","Check in as often as you like. It’s fine to skip days.")}</p>
      </figure>
      <div className="flex flex-wrap gap-2">{current==="unknown" && recent!=="unknown" && option(say("Вспомнить недавний момент","Recall a recent moment")+" · "+label(recent),()=>{setRecalled(true);setIndex(0);setAnswer("");go(6)})}
      {option(say("Продолжить","Continue"),()=>{setRecalled(false);setIndex(0);setAnswer("");go(6)})}</div></>}
    {step===6 && <><p>{recalled?say("Вспомните один недавний эпизод и отвечайте о нём.","Think of one recent episode and answer about that moment."):context}</p>
      <div className="flex flex-wrap gap-2">{[...scene.choices.map((_,i)=>situation(i)),say("По-другому","Something else")].map((v,i)=>option(v,()=>{if(i!==index)setAnswer("");setIndex(i);go(7)}))}</div></>}
    {step===7 && <form className="space-y-3" onSubmit={e=>{e.preventDefault();if(answer.trim())go(8)}}>
      <p className="text-muted-foreground">{choice}</p><Textarea aria-label={clarification} value={answer} maxLength={1000} onChange={e=>setAnswer(e.target.value)} placeholder={say("Можно одной фразой","A few words are enough")}/>
      <Button type="submit" disabled={!answer.trim()}>{say("Посмотреть наблюдение","See my observation")}</Button></form>}
    {step===8 && <><p>{record.observation}</p>
      <form className="space-y-3" onSubmit={event=>{
        event.preventDefault();
        if (!note.trim()) return;
        if (!onFinish({...record, note:{body:note.trim(), ...markMoment()}})) {
          setDraftError(true);
          return;
        }
        trackSurvey({event:"web_survey_step",action:"finish",question:"v2_observation",attempt,sequence:nextSequence()},locale);
      }}>
        <label htmlFor="intro-note" className="block font-normal leading-relaxed">{prompt}</label>
        <Textarea id="intro-note" value={note} onChange={e=>setNote(e.target.value)} placeholder={say("Ваша первая запись","Your first entry")}/>
        <Button type="submit" disabled={!note.trim()}>{say("Записать","Save entry")}</Button>
        {draftError && <p role="alert">{say("Браузеру не удалось сохранить черновик. Текст остался в поле. Разрешите хранение данных и попробуйте ещё раз.","Your browser couldn’t keep the draft. Your text is still here. Allow browser storage and try again.")}</p>}
      </form>
      <details className="border-t border-border pt-3 text-sm">
        <summary className="cursor-pointer">{say("Как выглядит недельный обзор · пример","What a weekly review looks like · example")}</summary>
        <div className="glass mt-3 space-y-3 rounded-2xl p-4">
          <p className="text-muted-foreground">{say("Из вымышленного дневника","From a fictional journal")}</p>
          <ul className="space-y-2">
            <li>{say("Вт · тревога · «Выходной, а я за завтраком всё проверяю рабочий чат».","Tue · Anxious · “It’s my day off and I keep checking the work chat over breakfast.”")}</li>
            <li>{say("Сб · тревога · «Опять читаю рабочую переписку, хотя сегодня никуда не надо».","Sat · Anxious · “Reading work messages again, even though I have the day off.”")}</li>
          </ul>
          <p><strong>{say("Что повторяется","What repeats")}</strong><br/>
            {say("Оба раза тревога отмечена в выходной. В обеих записях появляется рабочий чат.","Both anxious check-ins fell on days off. Both entries mention the work chat.")}</p>
        </div>
      </details></>}
    {step>0 && <div><Button variant="ghost" size="sm" onClick={()=>go(step-1)}>{say("Назад","Back")}</Button></div>}
  </section>;
}
