import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ShieldAlert, Mail, FileText } from "lucide-react"
import { Footer } from "@/components/layout/footer"

export const metadata: Metadata = {
  title: "Правообладателям (DMCA) — Weeb-X",
  description: "Информация для правообладателей. Процедура подачи DMCA-запросов на удаление контента.",
  alternates: {
    canonical: "https://weeb-x.com/dmca",
  },
  openGraph: {
    title: "Правообладателям (DMCA) — Weeb-X",
    description: "Информация для правообладателей. Процедура подачи DMCA-запросов на удаление контента.",
    type: "website",
    url: "https://weeb-x.com/dmca",
    siteName: "Weeb-X",
    locale: "ru_RU",
  },
}

export default function DMCAPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Правообладателям (DMCA)</h1>
          </div>
          <p className="text-muted-foreground">
            Информация для владельцев авторских прав и процедура подачи заявок на удаление контента.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Уведомление об авторских правах
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Weeb-X уважает права интеллектуальной собственности и стремится соблюдать законодательство 
              об авторском праве. Мы принимаем уведомления о предполагаемом нарушении авторских прав в 
              соответствии с Digital Millennium Copyright Act (DMCA).
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Если вы являетесь правообладателем или его представителем и считаете, что контент на нашем 
              сайте нарушает ваши авторские права, пожалуйста, отправьте нам уведомление в соответствии 
              с процедурой, описанной ниже.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Как подать DMCA-уведомление
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Для подачи уведомления о нарушении авторских прав отправьте письмо на наш email для 
              правообладателей. Ваше уведомление должно содержать следующую информацию:
            </p>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
              <li>
                <strong className="text-foreground">Электронная или физическая подпись</strong> лица, 
                уполномоченного действовать от имени владельца авторских прав.
              </li>
              <li>
                <strong className="text-foreground">Описание защищённого авторским правом произведения</strong>, 
                права на которое были нарушены.
              </li>
              <li>
                <strong className="text-foreground">Описание материала</strong>, который нарушает авторские 
                права, с указанием его местоположения на сайте (URL-адреса).
              </li>
              <li>
                <strong className="text-foreground">Ваши контактные данные</strong>: адрес, номер телефона 
                и адрес электронной почты.
              </li>
              <li>
                <strong className="text-foreground">Заявление</strong> о том, что вы добросовестно полагаете, 
                что использование материала не разрешено владельцем авторских прав, его агентом или законом.
              </li>
              <li>
                <strong className="text-foreground">Заявление</strong> о том, что предоставленная информация 
                точна и под страхом наказания за лжесвидетельство, что вы уполномочены действовать от имени 
                владельца авторских прав.
              </li>
            </ol>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Контакты для DMCA-запросов
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Отправляйте уведомления о нарушении авторских прав на специальный email для правообладателей:
            </p>
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <p className="text-foreground font-mono text-lg">
                dmca@weeb-x.com
              </p>
            </div>
            <p className="text-muted-foreground leading-relaxed mt-4">
              В теме письма укажите &laquo;DMCA Takedown Notice&raquo;. Мы рассмотрим ваше уведомление в 
              кратчайшие сроки и примем необходимые меры, включая удаление контента при необходимости.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Встречное уведомление
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Если вы считаете, что ваш контент был удалён ошибочно или в результате ошибки, вы можете 
              подать встречное уведомление. Встречное уведомление должно содержать:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Вашу подпись (электронную или физическую)</li>
              <li>Описание удалённого контента и его предыдущее местоположение</li>
              <li>Заявление под страхом наказания за лжесвидетельство, что контент был удалён по ошибке</li>
              <li>Ваши контактные данные</li>
              <li>Согласие на юрисдикцию вашего местного федерального суда</li>
            </ul>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Важная информация
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">
                <strong className="text-foreground">Обратите внимание:</strong> Мы не предоставляем 
                юридические консультации. Если у вас есть вопросы о ваших правах как правообладателя 
                или как пользователя, мы рекомендуем проконсультироваться с юристом.
              </p>
              <p className="leading-relaxed">
                <strong className="text-foreground">Злоупотребление:</strong> Ложные или недобросовестные 
                уведомления о нарушении авторских прав могут повлечь за собой юридическую ответственность. 
                Пожалуйста, убедитесь, что вы имеете законное право подавать такое уведомление.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 p-6 bg-primary/10 border border-primary/30 rounded-xl">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Другие вопросы?
          </h3>
          <p className="text-muted-foreground">
            По вопросам, не связанным с нарушением авторских прав, пожалуйста, используйте страницу{' '}
            <Link href="/contacts" className="text-primary hover:underline">
              «Контакты»
            </Link>
            .
          </p>
        </div>
      </div>

      <Footer />
    </div>
  )
}
