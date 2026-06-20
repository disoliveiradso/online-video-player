# MeetPlayer 🎬

**MeetPlayer** é um reprodutor de vídeo online de alta performance, projetado com uma interface moderna e controles intuitivos. Ele foi desenvolvido com o propósito de facilitar a reprodução de arquivos locais e links da internet diretamente no seu navegador, sendo totalmente otimizado para transmissões e reuniões no **Google Meet**.

---

## 🚀 Principais Recursos

- **⚡ Carregamento Local Instantâneo**: Selecione vídeos de qualquer tamanho do seu computador. A reprodução é instantânea e direta na memória (utilizando Object URLs), sem necessidade de upload e sem limite de gigabytes.
- **🌐 Compatibilidade Ampla de Links**: Cole links diretos (MP4, WebM), arquivos compartilhados em nuvem (Google Drive, Dropbox) e links do YouTube.
- **🤝 Otimizado para o Google Meet**: Integração com a API de áudio do HTML5, garantindo que ao compartilhar a guia do navegador a transmissão de som e imagem seja feita com zero atraso e máxima fluidez.
- **💬 Legendas Customizadas (CC)**: Carregue arquivos de legenda locais em formato `.srt` ou `.vtt`. O player faz a conversão automática do formato SRT para VTT em tempo de execução.
- **🖼️ Picture-in-Picture (PiP)**: Assista ao seu vídeo em uma janela flutuante no canto da tela enquanto acompanha o chat ou os participantes do Google Meet.
- **✨ Interface Premium**: Design escuro moderno com efeitos de vidro em blur (Glassmorphic), timeline responsiva na cor laranja e micro-animações.
- **⌨️ Atalhos de Teclado**: Controle total do player pelo teclado sem precisar do mouse.

---

## 🎮 Atalhos de Teclado

Durante a reprodução, você pode utilizar os seguintes atalhos:

| Tecla | Ação |
| :--- | :--- |
| `Espaço` | Reproduzir / Pausar (Play/Pause) |
| `Seta Esquerda` | Voltar 10 segundos |
| `Seta Direita` | Avançar 30 segundos |
| `Seta Cima` | Aumentar volume |
| `Seta Baixo` | Diminuir volume |
| `M` | Mudar/Restaurar áudio (Mudo) |
| `F` | Ativar / Desativar Tela Cheia |
| `P` | Ativar / Desativar Picture-in-Picture |

---

## 📺 Como Transmitir no Google Meet com Áudio Perfeito

Para garantir que o áudio do vídeo seja transmitido com a melhor qualidade possível para os outros participantes da reunião:

1. No Google Meet, clique no botão de **Apresentar agora** (ícone de tela com uma seta para cima).
2. Selecione a opção **Uma guia do Chrome** (essencial para transmitir o áudio nativo).
3. Selecione a guia do **MeetPlayer** na lista.
4. Certifique-se de manter marcada a caixa **"Compartilhar áudio da guia"** na parte inferior esquerda.
5. Clique em **Compartilhar** e pronto!

---

## 🛠️ Tecnologias Utilizadas

- **React 19**
- **Vite**
- **Tailwind CSS v4**
- **TypeScript**
- **Lucide React** (Ícones premium)

---

## 📦 Como Rodar Localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/disoliveiradso/online-video-player.git
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Abra o endereço `http://localhost:3000` no seu navegador Chrome ou Edge.

---

Desenvolvido por **[disoliveiradso](https://github.com/disoliveiradso)**.
