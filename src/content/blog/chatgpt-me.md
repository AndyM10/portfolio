---
title: 'Create your own GPT with Rust and HTMX'
description: 'Custom GPT like interface using htmx and Rust.'
pubDate: 'Feb 01 2023'
heroImage: '/rsxbot.png'
---

With Rust and Htmx exploding all over my social feed in recent months and with some down over christmas, I thought it was about time 
I got to grips with these technologies.

<br>

The idea is simple a rust server with two endpoints; one to server the static html files that will compose the frontend, and one to
accept any post requests made to our LLM which will be running locally using <mark>[ollama](https://ollama.ai/)</mark>, which will 
parse the response and send back the relevant html to update the ui.

![](/rustapi.png)


<br>

___

<br>
 
# The Server
For spinning up the server I used the <mark>[axum framework](https://docs.rs/axum/latest/axum/)</mark>, I am mainly a typescript / nodejs developer
the learning curve is steep for rust and this framework offered the most understandable syntax to me in order to get up and running quickly. 

<br>

To get started we must create our `main()` function as the entry point for our application, now as a naieve TS dev, I didnt realise that rust did 
not come with async support out of the box, and that async functionality is provided by the <mark>[tokio crate](https://docs.rs/tokio/latest)</mark> 
by applying the `#[tokio::main]` macro as a decorator to our function.

<br>

Now our syntax seems similar to other javascript based web frameworks I am used to, we instaniate a new Router object and attach our routes with 
our various endpoints, for now we will stick with our root route to return our htmx templates. 

<br>

```rust 
#[tokio::main]
async fn main() {
    let router = Router::new()
        .route("/", get(home))
        .route("/chat", post(chat))

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
                                            .await.unwrap();

    axum::serve(listener, router).await.unwrap();
}

```

<br>

Now that our server is up and running we need to implement our `home` handler. This handler must return data of the `Response` type, so we can define
our `home` handler as the such: 

```rust
#[derive(Template)]
#[template(path = "index.html")]
struct HomeTemplate;

async fn home() -> impl IntoResponse {
    HomeTemplate
}
```
Rust has implicit returns from functions so we can just type `HomeTemplate` here as it returns an implemenation of the IntoResponse trait. In this case the 
`HomeTemplate` struct has the `Template` trait from the [askama](https://github.com/djc/askama) crate attached and the path to the relevant html file. 

<br>

Our chat endpoint needs to take in our chat message from the user, add this to a list of messages that will act as our chat history, send this to Ollama 
and parse the response into our html template.

To do this we can use an `extractor` in this case the <mark>[form](https://docs.rs/axum/latest/axum/struct.Form.html)</mark> struct from axum allows us to deserialise
form data from the incoming request into the shape of the type we pass into it, in this case `UserMessage`. Lets also setup our askama template and return 
types. 

```rust
#[derive(Template)]
#[template(path = "msgs.html")]
struct MessagesTemplate {
    response: Vec<MessageResponse>,
}

#[derive(Deserialize)]
struct MessageResponse {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct UserMessage {
    message: String,
}

async fn chat(Form(form): Form<UserMessage>) -> impl IntoResponse {
    ...
}
```

In order to interact with Ollama I used the <mark>[ollama-rs](https://github.com/pepperoni21/ollama-rs)</mark> crate. Now when creating this I initially just passed
messages Vector of type `ChatMessage` directly into my template as it was exactly the shape and content I needed back on the UI, however after many hours debugging 
I realised that this this type doesnt match our function signature and implement the `IntoResponse` trait and that there is no way to add traits the third party crates.
So I created my own struct `MessageResponse` and mapped our ollama response to it. 

```rust

async fn chat(Form(form): Form<UserMessage>) -> impl IntoResponse {
    let ollama = Ollama::default();
    let mut messages: Vec<ChatMessage> = vec![];
    let user_message = ChatMessage::user(form.message);
    messages.push(user_message);

    let stream: ChatMessageResponse = ollama
        .send_chat_messages(ChatMessageRequest::new(
            "llama2:chat".to_string(),
            messages.clone(),
        ))
        .await
        .unwrap();

    let bot_message = stream.message.unwrap();
    messages.push(bot_message);

    let response: Vec<MessageResponse> = messages
        .iter()
        .map(|message| MessageResponse {
            role: format!("{:?}", message.role),
            content: message.content.clone(),
        })
        .collect();

    MessagesTemplate { response }
}  
```

<br>

___

# The Frontend

To start I created an `base.html` file, I liked to of this as a `layout` file in NextJS. Here I was able to import the htmx script and also my styles using 
<mark>[daisyUI](https://daisyui.com/)</mark>

```html
<!DOCTYPE html>
<html lang="en">
  <head>
  <script src="https://unpkg.com/htmx.org@1.9.6" integrity="sha384-FhXw7b6AlE/jyjlZH5iHa/tTe9EpJ1Y55RjcgPbjeWMskSxZt1v9qkxLJWNJaGni" crossorigin="anonymous"></script>
   <link
      href="https://cdn.jsdelivr.net/npm/daisyui@2.6.0/dist/full.css"
      rel="stylesheet"
      type="text/css"
    />
    <script src="https://unpkg.com/htmx.org/dist/ext/loading-states.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
  <title>{% block title %}{{ title }} - My Site{% endblock %}</title>
    {% block head %}{% endblock %}
  </head>
  <body>
    <div class="navbar bg-base-300">
      <div class="flex-1">
        <a class="btn btn-ghost text-xl">RsxBot</a>
      </div>
    <div class="flex-none">
    <button class="btn btn-square btn-ghost">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-5 h-5 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"></path></svg>
    </button>
    </div>
    </div>
      <div id="content" class="w-screen h-screen grid place-items-center">
        {% block content %}{% endblock %}
    </div>
  </body>
</html>
```

<br>

After I needed to create the chat interface, here is where i added the form we will send our messages to our `/chat` endpoint. I used the `hx-post` attribute to submit the 
request to our backend, `hx-target` to tell htmx where to place the returned html and finaly the `hx-swap` to tell htmx to replace all inner content of the targetted element 
with our response.


```html
<!-- index.html -->
{% extends "base.html" %}

{% block title %}Index{% endblock %}

{% block content %}
<div class="w-2/3 h-3/4 bg-base-300 rounded flex flex-col"  >
  <div class="w-full h-full" id="messages">
    <span class="loading loading-spinner text-accent"/>
  </div>
    <form class="flex flex-row p-2" hx-post="/chat" hx-target="#messages" hx-swap="innerHtml">
      <input type="text" class="input input-bordered w-3/4 mx-auto" name="message" placeholder="type your message here...">
      <button type="submit" class="btn btn-accent w-1/4">
        Send
        <span class="loading loading-spinner"></span>
      </button>
    </form>
</div>
{% endblock %}
```

The returned html is split into two files, one container file which will hold all the messages and one for the messages themselves. These are aptly named `msgs.html` and `msg.html`

```html
<!-- msgs.html -->
<div class="flex flex-col">
    {% for msg in response %}
	    {% include "msg.html" %}
    {% endfor %}
</div>

<!-- msg.html -->
<div class="chat chat-start">
  <div class="chat-header">
    {{ msg.role }}
  </div>
  <div class="chat-bubble chat-bubble-primary">{{ msg.content }}</div>
</div>
```

<br>

And thats it! a whistle stop tour of my first project in rust, I really liked this project as it was simple enough to build and put my basic knowledge of language to the test but
still provided plenty of challenges to kick start the learning proccess! 
