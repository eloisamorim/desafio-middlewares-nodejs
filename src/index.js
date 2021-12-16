const express = require("express");
const cors = require("cors");

const { v4: uuidv4, validate } = require("uuid");

const app = express();
app.use(express.json());
app.use(cors());

const users = [];

/* 
  Esse middleware é responsável por receber o username do usuário pelo header e 
  validar se existe ou não um usuário com o username passado. Caso exista, o 
  usuário deve ser repassado para o request e a função next deve ser chamada.
*/
function checksExistsUserAccount(request, response, next) {
  const { username } = request.headers;

  const [account] = users.filter((user) => user.username === username);

  if (!account) return response.status(404).json({ error: "User not found!" });

  request.user = account;

  next();
}

/* 
Esse middleware deve receber o **usuário** já dentro do request e chamar a função 
next apenas se esse usuário ainda estiver no **plano grátis e ainda não possuir 10 
*todos* cadastrados** ou se ele **já estiver com o plano Pro ativado**.
*/
function checksCreateTodosUserAvailability(request, response, next) {
  const { user } = request;

  if (user.todos.length < 10 || user.pro) {
    next();
  } else {
    response.status(403).json({ error: "User is not PRO" });
  }
}

/* 
  Esse middleware deve receber o **username** de dentro do header e o **id** de 
  um *todo* de dentro de `request.params`. Você deve validar o usuário, validar 
  que o `id` seja um uuid e também validar que esse `id` pertence a um *todo* do
  usuário informado.
  Com todas as validações passando, o *todo* encontrado deve ser passado para o 
  `request` assim como o usuário encontrado também e a função next deve ser chamada.
*/
function checksTodoExists(request, response, next) {
  const { username } = request.headers;
  const { id } = request.params;
  const [account] = users.filter((user) => user.username === username);
  const validateId = validate(id, 4);

  if (!validateId) {
    return response.status(400).json({ error: "Id is not uuid" });
  } else if (account) {
    const todoIdExists = account.todos.some((todo) => todo.id === id);

    if (todoIdExists) {
      for (const todo of account.todos) {
        if (todo.id === id) {
          request.user = account;
          request.todo = todo;
        }
      }
      next();
    } else {
      response.status(404).json({ error: "Todo not found" });
    }
  } else {
    response.status(404).json({ error: "User not found" });
  }
}

/*
Esse middleware possui um funcionamento semelhante ao middleware `checksExistsUserAccount` 
mas a busca pelo usuário deve ser feita através do **id** de um usuário passado
por parâmetro na rota. Caso o usuário tenha sido encontrado, o mesmo deve ser 
repassado para dentro do `request.user` e a função next deve ser chamada.
*/
function findUserById(request, response, next) {
  const { id } = request.params;
  const [user] = users.filter((account) => account.id === id);

  if (!user) return response.status(404).json({ error: "User not found!" });

  request.user = user;
  next();
}

app.post("/users", (request, response) => {
  const { name, username } = request.body;

  const usernameAlreadyExists = users.some(
    (user) => user.username === username
  );

  if (usernameAlreadyExists) {
    return response.status(400).json({ error: "Username already exists" });
  }

  const user = {
    id: uuidv4(),
    name,
    username,
    pro: false,
    todos: [],
  };

  users.push(user);

  return response.status(201).json(user);
});

app.get("/users/:id", findUserById, (request, response) => {
  const { user } = request;

  return response.json(user);
});

app.patch("/users/:id/pro", findUserById, (request, response) => {
  const { user } = request;

  if (user.pro) {
    return response
      .status(400)
      .json({ error: "Pro plan is already activated." });
  }

  user.pro = true;

  return response.json(user);
});

app.get("/todos", checksExistsUserAccount, (request, response) => {
  const { user } = request;

  return response.json(user.todos);
});

app.post(
  "/todos",
  checksExistsUserAccount,
  checksCreateTodosUserAvailability,
  (request, response) => {
    const { title, deadline } = request.body;
    const { user } = request;

    const newTodo = {
      id: uuidv4(),
      title,
      deadline: new Date(deadline),
      done: false,
      created_at: new Date(),
    };

    user.todos.push(newTodo);

    return response.status(201).json(newTodo);
  }
);

app.put("/todos/:id", checksTodoExists, (request, response) => {
  const { title, deadline } = request.body;
  const { todo } = request;

  todo.title = title;
  todo.deadline = new Date(deadline);

  return response.json(todo);
});

app.patch("/todos/:id/done", checksTodoExists, (request, response) => {
  const { todo } = request;

  todo.done = true;

  return response.json(todo);
});

app.delete(
  "/todos/:id",
  checksExistsUserAccount,
  checksTodoExists,
  (request, response) => {
    const { user, todo } = request;

    const todoIndex = user.todos.indexOf(todo);

    if (todoIndex === -1) {
      return response.status(404).json({ error: "Todo not found" });
    }

    user.todos.splice(todoIndex, 1);

    return response.status(204).send();
  }
);

module.exports = {
  app,
  users,
  checksExistsUserAccount,
  checksCreateTodosUserAvailability,
  checksTodoExists,
  findUserById,
};
