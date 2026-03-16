import { db, auth } from "./firebase.js";
import { addDoc, collection } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.getElementById("teacherRequestForm").onsubmit = async (e)=>{

e.preventDefault();

const user = auth.currentUser;

if(!user){
alert("Login required");
return;
}

const data = {

userId: user.uid,
email: user.email,

name: document.getElementById("name").value,
qualification: document.getElementById("qualification").value,
institution: document.getElementById("institution").value,
experience: document.getElementById("experience").value,
document: document.getElementById("document").value,
message: document.getElementById("message").value,

status: "pending",
createdAt: new Date()

};

await addDoc(collection(db,"teacher_requests"),data);

await fetch("/notify-teacher-request",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify(data)
});

alert("Request submitted successfully");

};
