import React, { useState } from 'react';
import { ShieldCheck, FileText, CheckCircle2, AlertTriangle, ScrollText } from 'lucide-react';
import logoImg from './logo.webp';

interface AllianceTermsModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onCancel?: () => void;
  loading?: boolean;
}

export const AllianceTermsModal: React.FC<AllianceTermsModalProps> = ({
  isOpen,
  onAccept,
  onCancel,
  loading = false,
}) => {
  const [hasScrolled, setHasScrolled] = useState(false);

  if (!isOpen) return null;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 80) {
      setHasScrolled(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-zinc-800">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-zinc-900 leading-tight">
                TERMOS DE DIVULGAÇÃO
              </h2>
              <p className="text-[11px] font-semibold text-zinc-500">
                ALLIANCE HUB • Aceite Obrigatório para Cadastro
              </p>
            </div>
          </div>
          <img src={logoImg} alt="Alliance Hub" className="h-6 object-contain hidden sm:block" />
        </div>

        {/* Notice alert */}
        <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2.5 flex items-center gap-2 text-amber-900 text-xs font-medium shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Por favor, leia os termos até o final para prosseguir com a criação da conta.</span>
        </div>

        {/* Scrollable Terms Content */}
        <div 
          onScroll={handleScroll}
          className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-zinc-600 leading-relaxed max-h-[55vh] select-text"
        >
          <div className="p-3 bg-zinc-100 rounded-xl border border-zinc-200 text-zinc-900 font-bold text-xs flex items-center justify-between">
            <span>Última atualização: 10 de agosto de 2026</span>
            <span className="text-[10px] bg-zinc-900 text-white px-2 py-0.5 rounded-full font-mono">ALLIANCE HUB</span>
          </div>

          <p className="font-medium text-zinc-700">
            Ao realizar qualquer divulgação, publicidade, campanha, publicação ou promoção relacionada à <strong className="text-zinc-900">ALLIANCE HUB</strong>, o usuário declara que leu, compreendeu e concorda integralmente com os presentes Termos de Divulgação.
          </p>

          <section className="space-y-1 pt-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">1. RESPONSABILIDADE PELA DIVULGAÇÃO</h3>
            <p>1.1. O usuário é integralmente responsável por todo e qualquer conteúdo, anúncio, publicação, mensagem, vídeo, imagem, story, postagem, transmissão ou qualquer outra forma de divulgação realizada por ele.</p>
            <p>1.2. A ALLIANCE HUB não se responsabiliza pelo conteúdo produzido, editado ou publicado pelo usuário fora dos materiais oficiais disponibilizados pela plataforma.</p>
            <p>1.3. O usuário deverá garantir que suas divulgações sejam verdadeiras, claras, adequadas e compatíveis com a legislação aplicável e com as regras da plataforma ou canal utilizado para divulgação.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">2. PROIBIÇÃO DE PROMESSAS DE GANHOS</h3>
            <p>2.1. É expressamente proibido ao usuário prometer, garantir ou sugerir ganhos financeiros, lucros determinados ou resultados garantidos em decorrência da utilização de qualquer produto, serviço, plataforma ou oferta divulgada.</p>
            <p>2.2. Expressões como <strong>"ganho garantido", "lucro certo", "renda garantida", "dinheiro fácil", "ganhe todos os dias", "sem risco", "retorno garantido"</strong> ou similares não poderão ser utilizadas sem autorização expressa e por escrito da ALLIANCE HUB.</p>
            <p>2.3. O usuário reconhece que resultados financeiros, comerciais ou econômicos podem variar de acordo com diversos fatores e não podem ser tratados como garantidos.</p>
            <p>2.4. Qualquer promessa de ganho realizada pelo usuário sem autorização será considerada de sua exclusiva responsabilidade.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">3. RESPONSABILIDADE SOBRE AS INFORMAÇÕES DIVULGADAS</h3>
            <p>3.1. O usuário deverá verificar as informações antes de publicá-las.</p>
            <p>3.2. A ALLIANCE HUB não será responsável por informações falsas, incompletas, exageradas, descontextualizadas ou incorretas acrescentadas pelo usuário à divulgação.</p>
            <p>3.3. Caso o usuário altere, edite ou complemente um material oficial fornecido pela ALLIANCE HUB, a responsabilidade pelo conteúdo alterado será exclusivamente do usuário.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">4. MATERIAIS OFICIAIS</h3>
            <p>4.1. A ALLIANCE HUB poderá disponibilizar banners, textos, vídeos, links, imagens, códigos promocionais e outros materiais para utilização pelos usuários.</p>
            <p>4.2. O usuário deverá utilizar os materiais de acordo com as orientações fornecidas pela ALLIANCE HUB.</p>
            <p>4.3. A alteração de informações relevantes presentes nos materiais oficiais, incluindo valores, condições, benefícios, regras, prazos ou características das ofertas, poderá caracterizar divulgação indevida.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">5. RESPONSABILIDADE PELOS CANAIS DE DIVULGAÇÃO</h3>
            <p>5.1. O usuário é responsável pelos canais utilizados para realizar suas divulgações.</p>
            <p>5.2. A ALLIANCE HUB não se responsabiliza por bloqueios, limitações, suspensões, remoções, strikes ou encerramentos de contas ocorridos em redes sociais, plataformas de anúncios, aplicativos de mensagens, sites ou quaisquer outros canais utilizados pelo usuário.</p>
            <p>5.3. O usuário deverá observar as políticas e regras de cada plataforma utilizada.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">6. PUBLICIDADE E LEGISLAÇÃO</h3>
            <p>6.1. O usuário deverá realizar suas divulgações em conformidade com a legislação aplicável, incluindo regras de publicidade, proteção ao consumidor, direitos autorais, proteção de dados e demais normas pertinentes.</p>
            <p>6.2. A utilização de publicidade enganosa, abusiva, fraudulenta ou que possa induzir terceiros ao erro é proibida.</p>
            <p>6.3. O usuário não poderá apresentar uma divulgação como se fosse uma comunicação oficial da ALLIANCE HUB quando ela não tiver sido produzida ou autorizada pela plataforma.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">7. PROIBIÇÃO DE INFORMAÇÕES ENGANOSAS</h3>
            <p>7.1. É proibido utilizar informações falsas ou enganosas para obter cliques, cadastros, depósitos, vendas, comissões ou qualquer outro benefício.</p>
            <p>7.2. Também é proibida a utilização de títulos, imagens ou mensagens que prometam benefícios inexistentes ou diferentes das condições reais da oferta.</p>
            <p>7.3. A utilização de depoimentos, resultados, prints, comprovantes ou demonstrações manipuladas ou falsificadas também é proibida.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">8. RESPONSABILIDADE POR TERCEIROS</h3>
            <p>8.1. Caso o usuário contrate influenciadores, afiliados, gestores de tráfego, agências ou terceiros para realizar divulgações em seu nome, deverá garantir que esses terceiros cumpram estes Termos.</p>
            <p>8.2. A contratação de terceiros não transfere automaticamente a responsabilidade do usuário perante a ALLIANCE HUB.</p>
            <p>8.3. O usuário poderá ser responsabilizado por divulgações realizadas por terceiros contratados por ele quando estiverem relacionadas à sua campanha, conta ou operação.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">9. USO DA MARCA ALLIANCE HUB</h3>
            <p>9.1. A utilização do nome, logotipo, identidade visual ou demais elementos de marca da ALLIANCE HUB deverá respeitar as orientações oficiais disponibilizadas pela plataforma.</p>
            <p>9.2. É proibida a criação de páginas, perfis, anúncios ou materiais que possam fazer terceiros acreditarem que o usuário representa oficialmente a ALLIANCE HUB, salvo quando houver autorização expressa.</p>
            <p>9.3. O usuário não poderá registrar domínios, perfis ou páginas utilizando a marca ALLIANCE HUB de maneira que possa causar confusão ou associação indevida.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">10. LINKS E REDIRECIONAMENTOS</h3>
            <p>10.1. O usuário deverá utilizar exclusivamente os links de divulgação disponibilizados ou autorizados pela ALLIANCE HUB.</p>
            <p>10.2. É proibida a utilização de redirecionamentos, páginas intermediárias ou métodos destinados a ocultar a origem real do tráfego quando isso contrariar as regras da ALLIANCE HUB.</p>
            <p>10.3. O usuário não poderá utilizar técnicas destinadas a gerar tráfego artificial, cliques fraudulentos ou conversões artificiais.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">11. TRÁFEGO PAGO</h3>
            <p>11.1. Caso a divulgação seja realizada por meio de tráfego pago, o usuário será responsável pelo conteúdo dos anúncios e pela observância das políticas da plataforma de publicidade utilizada.</p>
            <p>11.2. A ALLIANCE HUB não garante aprovação de anúncios, alcance, cliques, conversões, vendas ou qualquer resultado proveniente de campanhas de tráfego pago.</p>
            <p>11.3. Eventuais prejuízos decorrentes de investimento realizado pelo usuário em publicidade serão de responsabilidade do próprio usuário, salvo quando houver determinação expressa e documentada da ALLIANCE HUB em sentido contrário.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">12. RESULTADOS E DESEMPENHO</h3>
            <p>12.1. A ALLIANCE HUB não garante determinado número de vendas, cadastros, cliques, leads, depósitos, comissões ou qualquer outro resultado decorrente da divulgação.</p>
            <p>12.2. O desempenho das campanhas poderá variar de acordo com público, canal, conteúdo, orçamento, período, região, algoritmo, concorrência e outros fatores.</p>
            <p>12.3. Resultados obtidos anteriormente não constituem garantia de resultados futuros.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">13. RESPONSABILIDADE POR RECLAMAÇÕES</h3>
            <p>13.1. Reclamações decorrentes de informações, promessas ou condições apresentadas exclusivamente pelo usuário poderão ser de responsabilidade do próprio usuário.</p>
            <p>13.2. Caso o usuário divulgue condições diferentes das oficialmente disponibilizadas pela ALLIANCE HUB, não poderá atribuir à plataforma a responsabilidade pela informação que ele próprio criou ou modificou.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">14. CONDUTAS PROIBIDAS</h3>
            <p className="font-medium text-zinc-800">É proibido ao usuário:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>divulgar informações falsas;</li>
              <li>prometer ganhos garantidos;</li>
              <li>utilizar comprovantes falsificados;</li>
              <li>manipular resultados;</li>
              <li>utilizar identidade de terceiros sem autorização;</li>
              <li>realizar spam;</li>
              <li>utilizar bots ou tráfego artificial;</li>
              <li>utilizar práticas fraudulentas;</li>
              <li>criar páginas que se passem pela ALLIANCE HUB;</li>
              <li>omitir informações relevantes com o objetivo de induzir terceiros ao erro;</li>
              <li>utilizar materiais da ALLIANCE HUB fora das condições autorizadas;</li>
              <li>praticar qualquer conduta que possa prejudicar a imagem ou reputação da ALLIANCE HUB.</li>
            </ul>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">15. SUSPENSÃO E CANCELAMENTO</h3>
            <p>15.1. A ALLIANCE HUB poderá suspender ou encerrar o acesso do usuário aos recursos de divulgação caso identifique violação destes Termos.</p>
            <p>15.2. A suspensão poderá ocorrer de forma preventiva quando houver indícios de fraude, publicidade enganosa, manipulação de resultados ou outra conduta potencialmente prejudicial.</p>
            <p>15.3. Dependendo da gravidade da infração, a ALLIANCE HUB poderá cancelar campanhas, links, benefícios, comissões ou demais recursos relacionados à divulgação irregular, observadas as regras aplicáveis.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">16. RESPONSABILIDADE POR DANOS</h3>
            <p>16.1. O usuário poderá ser responsabilizado por prejuízos decorrentes de atos praticados em desacordo com estes Termos, especialmente quando houver fraude, má-fé, divulgação enganosa ou utilização indevida da marca.</p>
            <p>16.2. O usuário declara estar ciente de que suas ações de divulgação podem gerar consequências perante terceiros, plataformas de publicidade e autoridades competentes.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">17. AUSÊNCIA DE VÍNCULO DE REPRESENTAÇÃO</h3>
            <p>17.1. A participação em campanhas ou programas de divulgação da ALLIANCE HUB não concede automaticamente ao usuário poderes para representar, contratar, negociar ou assumir obrigações em nome da ALLIANCE HUB.</p>
            <p>17.2. O usuário não poderá afirmar que é funcionário, representante legal, sócio ou porta-voz oficial da ALLIANCE HUB sem autorização expressa.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">18. ALTERAÇÕES DOS TERMOS</h3>
            <p>18.1. A ALLIANCE HUB poderá atualizar estes Termos de Divulgação sempre que necessário.</p>
            <p>18.2. A continuidade da utilização dos recursos de divulgação após a publicação de alterações poderá representar a concordância do usuário com a versão atualizada, conforme permitido pela legislação aplicável.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">19. ACEITE</h3>
            <p>19.1. Ao utilizar links, materiais, campanhas ou recursos de divulgação disponibilizados pela ALLIANCE HUB, o usuário declara estar ciente de que <strong>a responsabilidade pela forma como realiza sua divulgação é exclusivamente sua</strong>.</p>
            <p>19.2. O usuário declara compreender que a ALLIANCE HUB <strong>não se responsabiliza por promessas de ganhos, resultados, informações ou condições adicionadas pelo usuário</strong>, especialmente quando não tenham sido previamente autorizadas.</p>
            <p>19.3. O usuário compromete-se a realizar suas divulgações de forma responsável, transparente e em conformidade com estes Termos e com a legislação aplicável.</p>
          </section>

          <div className="pt-2 text-center text-xs font-bold text-zinc-900">
            ALLIANCE HUB — Termos de Divulgação e Responsabilidade do Usuário
          </div>
        </div>

        {/* Footer with Action Button */}
        <div className="p-4 sm:p-5 border-t border-zinc-200 bg-zinc-50 flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="w-full sm:w-auto px-4 py-3 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              Voltar
            </button>
          )}

          <button
            type="button"
            onClick={onAccept}
            disabled={loading}
            className="w-full flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>Eu Aceito os Termos</span>
          </button>
        </div>

      </div>
    </div>
  );
};
